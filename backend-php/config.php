<?php
declare(strict_types=1);

/**
 * Zentrale Konfiguration des PHP-Backends.
 *
 * Geheimnisse (DB-Zugang, Google-OAuth, Session-Secret) werden NICHT im Code
 * abgelegt, sondern zur Laufzeit aus der bereits vorhandenen, erprobten
 * .env-Datei des alten Node-Backends gelesen:  .app/backend/.env
 *
 * Dadurch bleiben die Credentials an einem einzigen Ort und es entsteht kein
 * zweiter, abweichender Satz an Zugangsdaten.
 */

/** Liest eine .env-Datei (KEY=VALUE, optional in Anführungszeichen) in ein Array. */
function rz_parse_env(string $path): array
{
    $out = [];
    if (!is_file($path) || !is_readable($path)) {
        return $out;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        $eq = strpos($line, '=');
        if ($eq === false) {
            continue;
        }
        $key = trim(substr($line, 0, $eq));
        $val = trim(substr($line, $eq + 1));
        // Umschließende Anführungszeichen entfernen
        if (strlen($val) >= 2) {
            $first = $val[0];
            $last  = $val[strlen($val) - 1];
            if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                $val = substr($val, 1, -1);
            }
        }
        $out[$key] = $val;
    }
    return $out;
}

/** Zerlegt eine Prisma-DATABASE_URL (mysql://user:pass@host:port/db) in Bestandteile. */
function rz_parse_database_url(string $url): array
{
    $p = parse_url($url);
    if ($p === false) {
        throw new RuntimeException('DATABASE_URL konnte nicht geparst werden');
    }
    return [
        'host' => $p['host'] ?? 'localhost',
        'port' => isset($p['port']) ? (int) $p['port'] : 3306,
        'db'   => isset($p['path']) ? ltrim($p['path'], '/') : '',
        // Benutzer & Passwort sind in der URL prozent-kodiert
        'user' => isset($p['user']) ? rawurldecode($p['user']) : '',
        'pass' => isset($p['pass']) ? rawurldecode($p['pass']) : '',
    ];
}

/**
 * Sucht die .env an mehreren plausiblen Orten (Server-Layout + lokale Entwicklung).
 */
function rz_locate_env(): array
{
    $candidates = [
        __DIR__ . '/../.app/backend/.env',   // Server: webroot/api/ + webroot/.app/backend/.env
        __DIR__ . '/.env',                    // optionale lokale Override-Datei
        __DIR__ . '/../backend/.env',         // lokales Repo-Layout
    ];
    foreach ($candidates as $c) {
        if (is_file($c)) {
            return rz_parse_env($c);
        }
    }
    return [];
}

$env = rz_locate_env();

$databaseUrl = $env['DATABASE_URL'] ?? getenv('DATABASE_URL') ?: '';
if ($databaseUrl === '') {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Server-Konfiguration fehlt (DATABASE_URL)']);
    exit;
}
$db = rz_parse_database_url($databaseUrl);

// HTTPS robust erkennen (auch hinter Proxy / Load-Balancer)
$isHttps =
    (($_SERVER['HTTPS'] ?? '') !== '' && strtolower((string) $_SERVER['HTTPS']) !== 'off')
    || ((int) ($_SERVER['SERVER_PORT'] ?? 0) === 443)
    || (strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https');

return [
    'db' => $db,
    'frontendUrl'         => rtrim($env['FRONTEND_URL'] ?? 'https://rezepte.familie-ebert.net', '/'),
    'googleClientId'      => $env['GOOGLE_CLIENT_ID'] ?? '',
    'googleClientSecret'  => $env['GOOGLE_CLIENT_SECRET'] ?? '',
    'googleCallbackUrl'   => $env['GOOGLE_CALLBACK_URL'] ?? 'https://rezepte.familie-ebert.net/api/auth/google/callback',
    'sessionSecret'       => $env['SESSION_SECRET'] ?? 'change-me',
    'fetchTimeout'        => 12,            // Sekunden
    'maxResponseSize'     => 10 * 1024 * 1024,
    'isProduction'        => $isHttps,
    // Gemini-API-Schlüssel für Foto-Analyse und KI-Changelog (optional)
    'geminiApiKey'        => $env['GEMINI_API_KEY'] ?? '',
    // Absender-Adresse für Einladungs-E-Mails
    'mailFrom'            => $env['MAIL_FROM'] ?? 'noreply@familie-ebert.net',
];
