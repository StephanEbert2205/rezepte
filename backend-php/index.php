<?php
declare(strict_types=1);

/**
 * Front-Controller für /api/*  (request-basiert, kein Daemon).
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');

$cfg = require __DIR__ . '/config.php';

spl_autoload_register(static function (string $class): void {
    $file = __DIR__ . '/lib/' . $class . '.php';
    if (is_file($file)) {
        require $file;
    }
});

set_exception_handler(static function (Throwable $e): void {
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => 'Interner Serverfehler']);
});

Db::init($cfg['db']);
Auth::start($cfg);

// ── Request-Daten ───────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri    = $_SERVER['REQUEST_URI'] ?? '/';
$path   = parse_url($uri, PHP_URL_PATH) ?? '/';
$path   = '/' . trim($path, '/');

if ($path === '/api') {
    $path = '/';
} elseif (str_starts_with($path, '/api/')) {
    $path = substr($path, 4);
}

$readJsonBody = static function () {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
};

// ── Auth-Routen (ohne Login-Pflicht) ─────────────────────────────────────────
if ($path === '/auth/google' && $method === 'GET') {
    $state = bin2hex(random_bytes(16));
    $_SESSION['oauth_state'] = $state;
    // Optionalen Redirect-Ziel in Session speichern
    if (!empty($_GET['redirect'])) {
        $_SESSION['oauth_redirect'] = (string) $_GET['redirect'];
    }
    // Einladungs-Token aus dem Query-Parameter übernehmen
    if (!empty($_GET['invite'])) {
        $_SESSION['oauth_invite'] = (string) $_GET['invite'];
    }
    Response::redirect(GoogleOAuth::authUrl($cfg, $state));
}

if ($path === '/auth/google/callback' && $method === 'GET') {
    $code        = $_GET['code']  ?? '';
    $state       = $_GET['state'] ?? '';
    $expected    = $_SESSION['oauth_state']   ?? null;
    $redirect    = $_SESSION['oauth_redirect'] ?? null;
    $inviteToken = $_SESSION['oauth_invite']   ?? null;
    unset($_SESSION['oauth_state'], $_SESSION['oauth_redirect'], $_SESSION['oauth_invite']);
    try {
        if ($code === '' || $expected === null || !hash_equals((string) $expected, (string) $state)) {
            throw new RuntimeException('OAuth state/code ungültig');
        }
        $profile = GoogleOAuth::fetchProfile($cfg, (string) $code);
        Auth::loginWithGoogleProfile($profile);

        // Einladungs-Token verarbeiten: pending Link anlegen und sofort annehmen
        if ($inviteToken !== null) {
            $loggedUser = Auth::currentUser();
            if ($loggedUser !== null) {
                try {
                    $lnk = Accounts::processInvitation($inviteToken, (int) $loggedUser['id']);
                    Accounts::acceptLink((int) $lnk['id'], (int) $loggedUser['id']);
                } catch (Throwable) {
                    // Fehler ignorieren – Nutzer sieht ggf. Hinweis im Profil
                }
            }
        }

        // Nach Login: gespeicherten Redirect oder Startseite
        $dest = ($redirect !== null && str_starts_with($redirect, '/'))
            ? $cfg['frontendUrl'] . $redirect
            : $cfg['frontendUrl'];
        Response::redirect($dest);
    } catch (Throwable $e) {
        Response::redirect($cfg['frontendUrl'] . '/login?error=1');
    }
}

if ($path === '/auth/me' && $method === 'GET') {
    $user = Auth::currentUser();
    if ($user === null) {
        Response::error('Nicht angemeldet', 401);
    }
    Response::json($user);
}

if ($path === '/auth/logout' && $method === 'POST') {
    Auth::logout();
    Response::json(['ok' => true]);
}

// ── Öffentliche Routen (kein Login nötig) ────────────────────────────────────

// GET /invitations/:token  – Einladungs-Details für die Landingpage
if (preg_match('#^/invitations/([A-Fa-f0-9]{64})$#', $path, $m) && $method === 'GET') {
    $inv = Accounts::getInvitationByToken($m[1]);
    if ($inv === null) {
        Response::error('Einladung nicht gefunden oder abgelaufen', 404);
    }
    Response::json($inv);
}

// GET /shared/:token  – Rezept-Vorschau für geteilten Link
if (preg_match('#^/shared/([A-Fa-f0-9]{64})$#', $path, $m) && $method === 'GET') {
    $recipe = Sharing::getRecipeByToken($m[1]);
    if ($recipe === null) {
        Response::error('Freigabelink ungültig oder abgelaufen', 404);
    }
    Response::json($recipe);
}

// GET /changelog  – öffentliche App-Updates (keine Anmeldung nötig)
if ($path === '/changelog' && $method === 'GET') {
    Response::json(Changelog::listPublished());
}

// ── Ab hier: Anmeldung erforderlich ──────────────────────────────────────────
// (POST /changelog/read wird weiter unten nach dem Auth-Check behandelt)
$me = Auth::require();
$uid = $me['id'];

// POST /changelog/read  – Changelog als gelesen markieren
if ($path === '/changelog/read' && $method === 'POST') {
    Changelog::markRead($uid);
    Response::json(['ok' => true]);
}

// POST /parse-image  – Rezeptfoto via KI analysieren (multipart/form-data)
if ($path === '/parse-image' && $method === 'POST') {
    if (empty($cfg['geminiApiKey'])) {
        Response::error('KI-Bildanalyse nicht konfiguriert (GEMINI_API_KEY fehlt)', 503);
    }
    if (empty($_FILES['image'])) {
        Response::error('Kein Bild empfangen', 400);
    }
    try {
        // Bild ZUERST sichern (copy statt move, damit tmp_name für ImageParser erhalten bleibt)
        $savedImageUrl = null;
        if (is_uploaded_file($_FILES['image']['tmp_name'] ?? '')) {
            $mimeMap   = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
            $ext       = $mimeMap[$_FILES['image']['type']] ?? 'jpg';
            $filename  = bin2hex(random_bytes(12)) . '.' . $ext;
            $uploadDir = __DIR__ . '/../uploads/recipe-photos';
            if (!is_dir($uploadDir)) {
                @mkdir($uploadDir, 0755, true);
            }
            if (is_dir($uploadDir) && @copy($_FILES['image']['tmp_name'], $uploadDir . '/' . $filename)) {
                $savedImageUrl = $cfg['frontendUrl'] . '/uploads/recipe-photos/' . $filename;
            }
        }

        $result = ImageParser::parse($_FILES['image'], $cfg['geminiApiKey']);

        if ($savedImageUrl !== null) {
            $result['imageUrl'] = $savedImageUrl;
        }

        Response::json($result);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

// POST /import
if ($path === '/import' && $method === 'POST') {
    [$data, $err] = Validator::importBody($readJsonBody());
    if ($err !== null) {
        Response::error($err, 400);
    }
    try {
        $id = Importer::fromUrl($data['url'], $cfg, $uid);
        Response::json(['id' => $id, 'message' => 'Rezept erfolgreich importiert'], 201);
    } catch (RuntimeException $e) {
        $msg = $e->getMessage();
        if (str_starts_with($msg, 'DUPLICATE:')) {
            $existingId = (int) substr($msg, strlen('DUPLICATE:'));
            Response::error('Rezept bereits vorhanden', 409, ['existingId' => $existingId]);
        }
        Response::error($msg, 500);
    }
}

// GET /recipes
if ($path === '/recipes' && $method === 'GET') {
    $tags = isset($_GET['tags']) && $_GET['tags'] !== ''
        ? array_values(array_filter(explode(',', (string) $_GET['tags']), static fn($s) => $s !== ''))
        : [];
    $result = Recipes::listRecipes([
        'search'       => $_GET['search'] ?? null,
        'tags'         => $tags,
        'isVegetarian' => ($_GET['vegetarian'] ?? '') === 'true',
        'isVegan'      => ($_GET['vegan'] ?? '') === 'true',
        'isGlutenFree' => ($_GET['glutenFree'] ?? '') === 'true',
        'maxTime'      => isset($_GET['maxTime']) ? (int) $_GET['maxTime'] : null,
        'page'         => isset($_GET['page']) ? (int) $_GET['page'] : 1,
        'limit'        => isset($_GET['limit']) ? (int) $_GET['limit'] : 20,
    ], $uid);
    Response::json($result);
}

// GET /recipes/tags
if ($path === '/recipes/tags' && $method === 'GET') {
    Response::json(Recipes::getAllTags($uid));
}

// ── Freigabe-Routen ─────────────────────────────────────────────────────────

// POST /recipes/:id/share/token  – Freigabelink (Token) erzeugen
if (preg_match('#^/recipes/(\d+)/share/token$#', $path, $m) && $method === 'POST') {
    try {
        $result = Sharing::createToken((int) $m[1], $uid);
        Response::json($result, 201);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    }
}

// GET /recipes/:id/shares  – alle direkten Freigaben eines Rezepts
if (preg_match('#^/recipes/(\d+)/shares$#', $path, $m) && $method === 'GET') {
    try {
        Response::json(Sharing::getSharesForRecipe((int) $m[1], $uid));
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    }
}

// POST /recipes/:id/shares  – Rezept direkt mit User teilen
if (preg_match('#^/recipes/(\d+)/shares$#', $path, $m) && $method === 'POST') {
    $body  = $readJsonBody();
    $email = trim((string) ($body['email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        Response::error('Ungültige E-Mail-Adresse', 400);
    }
    $canEdit = !empty($body['canEdit']);
    try {
        $share = Sharing::shareWithUser((int) $m[1], $uid, $email, $canEdit);
        Response::json($share, 201);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 400);
    }
}

// DELETE /recipes/:id/shares/:sharedWithId  – Freigabe entfernen
if (preg_match('#^/recipes/(\d+)/shares/(\d+)$#', $path, $m) && $method === 'DELETE') {
    try {
        Sharing::removeShare((int) $m[1], $uid, (int) $m[2]);
        Response::noContent();
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    }
}

// POST /shared/:token/fork  – geteiltes Rezept kopieren
if (preg_match('#^/shared/([A-Fa-f0-9]{64})/fork$#', $path, $m) && $method === 'POST') {
    try {
        $newId = Sharing::forkByToken($m[1], $uid);
        Response::json(['id' => $newId, 'message' => 'Rezept wurde in deine Sammlung kopiert'], 201);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 400);
    }
}

// ── Kontoverbindungs-Routen ──────────────────────────────────────────────────

// GET /accounts/links  – eigene Verknüpfungen auflisten
if ($path === '/accounts/links' && $method === 'GET') {
    Response::json(Accounts::getLinks($uid));
}

// POST /accounts/links  – Verknüpfungsanfrage senden (oder Einladung verschicken)
if ($path === '/accounts/links' && $method === 'POST') {
    $body  = $readJsonBody();
    $email = trim((string) ($body['email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        Response::error('Ungültige E-Mail-Adresse', 400);
    }
    try {
        $result = Accounts::requestLink($uid, $email, $cfg);
        Response::json($result, 201);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 400);
    }
}

// GET /accounts/invitations  – eigene gesendete Einladungen auflisten
if ($path === '/accounts/invitations' && $method === 'GET') {
    Response::json(Accounts::getInvitations($uid));
}

// DELETE /accounts/invitations/:id  – Einladung zurückziehen
if (preg_match('#^/accounts/invitations/(\d+)$#', $path, $m) && $method === 'DELETE') {
    try {
        Accounts::cancelInvitation((int) $m[1], $uid);
        Response::noContent();
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 404);
    }
}

// POST /invitations/:token/accept  – Einladung annehmen (eingeloggter Nutzer)
if (preg_match('#^/invitations/([A-Fa-f0-9]{64})/accept$#', $path, $m) && $method === 'POST') {
    try {
        $lnk      = Accounts::processInvitation($m[1], $uid);
        $accepted = Accounts::acceptLink((int) $lnk['id'], $uid);
        Response::json($accepted, 201);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 400);
    }
}

// POST /accounts/links/:id/accept  – Anfrage annehmen
if (preg_match('#^/accounts/links/(\d+)/accept$#', $path, $m) && $method === 'POST') {
    try {
        $link = Accounts::acceptLink((int) $m[1], $uid);
        Response::json($link);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 400);
    }
}

// DELETE /accounts/links/:id  – Verknüpfung entfernen
if (preg_match('#^/accounts/links/(\d+)$#', $path, $m) && $method === 'DELETE') {
    try {
        Accounts::removeLink((int) $m[1], $uid);
        Response::noContent();
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    }
}

// POST /recipes  – Rezept manuell anlegen
if ($path === '/recipes' && $method === 'POST') {
    [$data, $err] = Validator::createBody($readJsonBody());
    if ($err !== null) {
        Response::error($err, 400);
    }
    $id = Recipes::create($data, $uid);
    Response::json(['id' => $id, 'message' => 'Rezept erfolgreich angelegt'], 201);
}

// ── /recipes/:id  (GET, PUT, DELETE) ────────────────────────────────────────
if (preg_match('#^/recipes/([^/]+)$#', $path, $m)) {
    $idRaw = $m[1];
    if (!ctype_digit($idRaw)) {
        Response::error('Ungültige ID', 400);
    }
    $id = (int) $idRaw;

    if ($method === 'GET') {
        $recipe = Recipes::getById($id, $uid);
        if ($recipe === null) {
            Response::error('Rezept nicht gefunden', 404);
        }
        Response::json($recipe);
    }

    if ($method === 'PUT') {
        [$data, $err] = Validator::updateBody($readJsonBody());
        if ($err !== null) {
            Response::error($err, 400);
        }
        [$recipe, $updErr] = Recipes::update($id, $uid, $data);
        if ($updErr !== null) {
            Response::error($updErr, 403);
        }
        Response::json($recipe);
    }

    if ($method === 'DELETE') {
        try {
            Recipes::delete($id, $uid);
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 403);
        }
        Response::noContent();
    }
}

// ── Rezept-Meldungen ─────────────────────────────────────────────────────────

// POST /recipes/:id/report  – Problem melden
if (preg_match('#^/recipes/(\d+)/report$#', $path, $m) && $method === 'POST') {
    $body       = $readJsonBody();
    $categories = array_values(array_filter(
        is_array($body['categories'] ?? null) ? $body['categories'] : [],
        'is_string'
    ));
    $comment    = trim((string) ($body['comment'] ?? ''));
    try {
        $id = Reports::create((int) $m[1], $uid, $categories, $comment);
        Response::json(['id' => $id, 'message' => 'Meldung eingereicht'], 201);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 400);
    }
}

// ── Admin-Routen ─────────────────────────────────────────────────────────────

if (str_starts_with($path, '/admin')) {
    Auth::requireAdmin(); // wirft 401/403 wenn nicht Admin

    // GET /admin/stats
    if ($path === '/admin/stats' && $method === 'GET') {
        Response::json(Admin::getStats());
    }

    // GET /admin/users
    if ($path === '/admin/users' && $method === 'GET') {
        Response::json(Admin::getUsers());
    }

    // POST /admin/users/:id/toggle-admin
    if (preg_match('#^/admin/users/(\d+)/toggle-admin$#', $path, $m) && $method === 'POST') {
        try {
            Response::json(Admin::toggleAdmin((int) $m[1], $uid));
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    // GET /admin/recipes
    if ($path === '/admin/recipes' && $method === 'GET') {
        Response::json(Admin::listRecipes([
            'search' => $_GET['search'] ?? '',
            'userId' => isset($_GET['userId']) ? (int) $_GET['userId'] : 0,
            'page'   => isset($_GET['page'])   ? (int) $_GET['page']   : 1,
            'limit'  => isset($_GET['limit'])  ? (int) $_GET['limit']  : 20,
        ]));
    }

    // GET /admin/links
    if ($path === '/admin/links' && $method === 'GET') {
        Response::json(Admin::getLinks());
    }

    // GET /admin/reports?status=open|resolved|all
    if ($path === '/admin/reports' && $method === 'GET') {
        $status = $_GET['status'] ?? 'open';
        Response::json(Reports::getAll($status));
    }

    // POST /admin/reports/:id/resolve
    if (preg_match('#^/admin/reports/(\d+)/resolve$#', $path, $m) && $method === 'POST') {
        try {
            Reports::resolve((int) $m[1]);
            Response::json(['ok' => true]);
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 404);
        }
    }

    // ── Changelog-Verwaltung ─────────────────────────────────────────────────

    // ── Changelog: Einträge ──────────────────────────────────────────────────

    // GET /admin/changelog  – alle Einträge inkl. Entwürfe
    if ($path === '/admin/changelog' && $method === 'GET') {
        Response::json(Changelog::listAll());
    }

    // POST /admin/changelog  – neuen Eintrag anlegen
    if ($path === '/admin/changelog' && $method === 'POST') {
        try {
            $entry = Changelog::create($readJsonBody());
            Response::json($entry, 201);
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    // PUT /admin/changelog/:id  – Eintrag bearbeiten
    if (preg_match('#^/admin/changelog/(\d+)$#', $path, $m) && $method === 'PUT') {
        try {
            $entry = Changelog::update((int) $m[1], $readJsonBody());
            Response::json($entry);
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    // DELETE /admin/changelog/:id  – Eintrag löschen
    if (preg_match('#^/admin/changelog/(\d+)$#', $path, $m) && $method === 'DELETE') {
        Changelog::delete((int) $m[1]);
        Response::noContent();
    }

    // POST /admin/changelog/:id/publish  – veröffentlichen
    if (preg_match('#^/admin/changelog/(\d+)/publish$#', $path, $m) && $method === 'POST') {
        Response::json(Changelog::publish((int) $m[1]));
    }

    // POST /admin/changelog/:id/unpublish  – zurück auf Entwurf
    if (preg_match('#^/admin/changelog/(\d+)/unpublish$#', $path, $m) && $method === 'POST') {
        Response::json(Changelog::unpublish((int) $m[1]));
    }

    // ── Changelog: Commit-Review ─────────────────────────────────────────────

    // POST /admin/changelog/import-commits  – neue Commits aus .pending-commits.json importieren
    if ($path === '/admin/changelog/import-commits' && $method === 'POST') {
        Response::json(Changelog::importCommits());
    }

    // GET /admin/changelog/commits  – alle Commits (optional ?status=pending|included|skipped)
    if ($path === '/admin/changelog/commits' && $method === 'GET') {
        $status = isset($_GET['status']) && $_GET['status'] !== '' ? (string) $_GET['status'] : null;
        Response::json(Changelog::listCommits($status));
    }

    // POST /admin/changelog/commits/:id/include  – Commit aufnehmen
    if (preg_match('#^/admin/changelog/commits/(\d+)/include$#', $path, $m) && $method === 'POST') {
        try {
            Response::json(Changelog::decideCommit((int) $m[1], 'included'));
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    // POST /admin/changelog/commits/:id/skip  – Commit überspringen
    if (preg_match('#^/admin/changelog/commits/(\d+)/skip$#', $path, $m) && $method === 'POST') {
        try {
            Response::json(Changelog::decideCommit((int) $m[1], 'skipped'));
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    // POST /admin/changelog/bulk-decide  – Massen-Entscheidung
    // Body: { filter: 'non-technical'|'technical'|'all', decision: 'included'|'skipped' }
    if ($path === '/admin/changelog/bulk-decide' && $method === 'POST') {
        $body     = $readJsonBody();
        $filter   = (string) ($body['filter']   ?? 'non-technical');
        $decision = (string) ($body['decision'] ?? 'included');
        try {
            $count = Changelog::bulkDecide($filter, $decision);
            Response::json(['affected' => $count]);
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    // POST /admin/changelog/build-draft  – Entwurf aus aufgenommenen Commits erstellen
    if ($path === '/admin/changelog/build-draft' && $method === 'POST') {
        $entry = Changelog::buildDraft();
        if ($entry === null) {
            Response::error('Keine aufgenommenen Commits ohne Eintrag vorhanden', 400);
        }
        Response::json($entry, 201);
    }

    // GET /admin/changelog/pending-count  – Badge-Zähler
    if ($path === '/admin/changelog/pending-count' && $method === 'GET') {
        Response::json(['count' => Changelog::countPending()]);
    }

    // ── KI-Entwürfe ──────────────────────────────────────────────────────────

    // GET /admin/changelog/ai-pending  – alle ausstehenden KI-Entwürfe
    if ($path === '/admin/changelog/ai-pending' && $method === 'GET') {
        Response::json(Changelog::listAiPending());
    }

    // POST /admin/changelog/:id/approve  – KI-Entwurf aufnehmen (veröffentlichen)
    if (preg_match('#^/admin/changelog/(\d+)/approve$#', $path, $m) && $method === 'POST') {
        Response::json(Changelog::approveAiDraft((int) $m[1]));
    }

    // DELETE /admin/changelog/:id/ai  – KI-Entwurf überspringen (löschen)
    if (preg_match('#^/admin/changelog/(\d+)/ai$#', $path, $m) && $method === 'DELETE') {
        Changelog::skipAiDraft((int) $m[1]);
        Response::noContent();
    }
}

// ── Fallback ─────────────────────────────────────────────────────────────────
Response::error('Nicht gefunden', 404);
