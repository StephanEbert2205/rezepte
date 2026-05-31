<?php
declare(strict_types=1);

/**
 * Front-Controller für /api/*  (request-basiert, kein Daemon).
 *
 * Jede /api-Anfrage wird per .htaccess hierher umgeleitet. Das ersetzt das
 * komplette Express/Node-Backend und läuft stabil auf dem KAS-Shared-Hosting,
 * weil pro Request ein normaler PHP-Prozess startet und endet – nichts läuft
 * dauerhaft und kann daher auch nicht "gereapt" werden.
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

// Unerwartete Fehler in sauberes JSON verwandeln (statt HTML-Fehlerseite)
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

// führendes /api entfernen
if ($path === '/api') {
    $path = '/';
} elseif (str_starts_with($path, '/api/')) {
    $path = substr($path, 4); // behält führenden Slash
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
    Response::redirect(GoogleOAuth::authUrl($cfg, $state));
}

if ($path === '/auth/google/callback' && $method === 'GET') {
    $code  = $_GET['code']  ?? '';
    $state = $_GET['state'] ?? '';
    $expected = $_SESSION['oauth_state'] ?? null;
    unset($_SESSION['oauth_state']);
    try {
        if ($code === '' || $expected === null || !hash_equals((string) $expected, (string) $state)) {
            throw new RuntimeException('OAuth state/code ungültig');
        }
        $profile = GoogleOAuth::fetchProfile($cfg, (string) $code);
        Auth::loginWithGoogleProfile($profile);
        Response::redirect($cfg['frontendUrl']);
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

// ── Ab hier: Anmeldung erforderlich ──────────────────────────────────────────
Auth::require();

// POST /import
if ($path === '/import' && $method === 'POST') {
    [$data, $err] = Validator::importBody($readJsonBody());
    if ($err !== null) {
        Response::error($err, 400);
    }
    try {
        $id = Importer::fromUrl($data['url'], $cfg);
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
    ]);
    Response::json($result);
}

// GET /recipes/tags
if ($path === '/recipes/tags' && $method === 'GET') {
    Response::json(Recipes::getAllTags());
}

// /recipes/:id  (GET, PUT, DELETE)
if (preg_match('#^/recipes/([^/]+)$#', $path, $m)) {
    $idRaw = $m[1];
    if (!ctype_digit($idRaw)) {
        Response::error('Ungültige ID', 400);
    }
    $id = (int) $idRaw;

    if ($method === 'GET') {
        $recipe = Recipes::getById($id);
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
        [$recipe, $updErr] = Recipes::update($id, $data);
        if ($updErr !== null) {
            Response::error($updErr, 404);
        }
        Response::json($recipe);
    }

    if ($method === 'DELETE') {
        Recipes::delete($id);
        Response::noContent();
    }
}

// ── Fallback ─────────────────────────────────────────────────────────────────
Response::error('Nicht gefunden', 404);
