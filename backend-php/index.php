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
    Response::redirect(GoogleOAuth::authUrl($cfg, $state));
}

if ($path === '/auth/google/callback' && $method === 'GET') {
    $code     = $_GET['code']  ?? '';
    $state    = $_GET['state'] ?? '';
    $expected = $_SESSION['oauth_state'] ?? null;
    $redirect = $_SESSION['oauth_redirect'] ?? null;
    unset($_SESSION['oauth_state'], $_SESSION['oauth_redirect']);
    try {
        if ($code === '' || $expected === null || !hash_equals((string) $expected, (string) $state)) {
            throw new RuntimeException('OAuth state/code ungültig');
        }
        $profile = GoogleOAuth::fetchProfile($cfg, (string) $code);
        Auth::loginWithGoogleProfile($profile);
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

// ── Öffentliche Freigabe-Route (kein Login nötig) ─────────────────────────────
// GET /shared/:token  – Rezept-Vorschau für geteilten Link
if (preg_match('#^/shared/([A-Fa-f0-9]{64})$#', $path, $m) && $method === 'GET') {
    $recipe = Sharing::getRecipeByToken($m[1]);
    if ($recipe === null) {
        Response::error('Freigabelink ungültig oder abgelaufen', 404);
    }
    Response::json($recipe);
}

// ── Ab hier: Anmeldung erforderlich ──────────────────────────────────────────
$me = Auth::require();
$uid = $me['id'];

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

// POST /accounts/links  – Verknüpfungsanfrage senden
if ($path === '/accounts/links' && $method === 'POST') {
    $body  = $readJsonBody();
    $email = trim((string) ($body['email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        Response::error('Ungültige E-Mail-Adresse', 400);
    }
    try {
        $link = Accounts::requestLink($uid, $email);
        Response::json($link, 201);
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

// ── Fallback ─────────────────────────────────────────────────────────────────
Response::error('Nicht gefunden', 404);
