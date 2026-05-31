<?php
declare(strict_types=1);

/**
 * Authentifizierung über native PHP-Sessions (ersetzt express-session + passport.session).
 */
final class Auth
{
    private const COOKIE_NAME = 'rezepte_sid';
    private const LIFETIME    = 7 * 24 * 60 * 60; // 7 Tage

    public static function start(array $cfg): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        session_name(self::COOKIE_NAME);
        session_set_cookie_params([
            'lifetime' => self::LIFETIME,
            'path'     => '/',
            'httponly' => true,
            'secure'   => (bool) $cfg['isProduction'],
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    /** @return array{id:int,name:string,email:string,picture:?string}|null */
    public static function currentUser(): ?array
    {
        $uid = $_SESSION['userId'] ?? null;
        if (!is_int($uid) && !(is_string($uid) && ctype_digit($uid))) {
            return null;
        }
        $row = Db::one("SELECT `id`, `name`, `email`, `picture` FROM `users` WHERE `id` = ?", [(int) $uid]);
        if ($row === null) {
            return null;
        }
        return [
            'id'      => (int) $row['id'],
            'name'    => $row['name'],
            'email'   => $row['email'],
            'picture' => $row['picture'],
        ];
    }

    /** Erzwingt Anmeldung; sendet 401 und beendet, falls nicht angemeldet. */
    public static function require(): array
    {
        $user = self::currentUser();
        if ($user === null) {
            Response::error('Nicht angemeldet', 401);
        }
        return $user;
    }

    /** Legt Nutzer aus Google-Profil an/aktualisiert ihn und meldet ihn an. */
    public static function loginWithGoogleProfile(array $profile): void
    {
        $existing = Db::one("SELECT `id` FROM `users` WHERE `googleId` = ?", [$profile['sub']]);
        if ($existing !== null) {
            $id = (int) $existing['id'];
            Db::run(
                "UPDATE `users` SET `name` = ?, `picture` = ? WHERE `id` = ?",
                [$profile['name'], $profile['picture'], $id]
            );
        } else {
            Db::run(
                "INSERT INTO `users` (`googleId`, `email`, `name`, `picture`, `createdAt`)
                 VALUES (?, ?, ?, ?, ?)",
                [$profile['sub'], $profile['email'], $profile['name'], $profile['picture'], gmdate('Y-m-d H:i:s')]
            );
            $id = Db::lastId();
        }
        session_regenerate_id(true);
        $_SESSION['userId'] = $id;
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires'  => time() - 42000,
                'path'     => $p['path'],
                'domain'   => $p['domain'],
                'secure'   => $p['secure'],
                'httponly' => $p['httponly'],
                'samesite' => 'Lax',
            ]);
        }
        session_destroy();
    }
}
