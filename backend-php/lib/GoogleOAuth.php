<?php
declare(strict_types=1);

/**
 * Google OAuth2 (Authorization Code Flow) per cURL – ersetzt passport-google-oauth20.
 */
final class GoogleOAuth
{
    private const AUTH_ENDPOINT  = 'https://accounts.google.com/o/oauth2/v2/auth';
    private const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
    private const USERINFO       = 'https://openidconnect.googleapis.com/v1/userinfo';

    public static function authUrl(array $cfg, string $state): string
    {
        $params = [
            'client_id'     => $cfg['googleClientId'],
            'redirect_uri'  => $cfg['googleCallbackUrl'],
            'response_type' => 'code',
            'scope'         => 'openid email profile',
            'state'         => $state,
            'access_type'   => 'online',
            'prompt'        => 'select_account',
        ];
        return self::AUTH_ENDPOINT . '?' . http_build_query($params);
    }

    /**
     * Tauscht den Code gegen ein Token und holt das Nutzerprofil.
     * @return array{sub:string,email:string,name:string,picture:?string}
     * @throws RuntimeException
     */
    public static function fetchProfile(array $cfg, string $code): array
    {
        $token = self::post(self::TOKEN_ENDPOINT, [
            'code'          => $code,
            'client_id'     => $cfg['googleClientId'],
            'client_secret' => $cfg['googleClientSecret'],
            'redirect_uri'  => $cfg['googleCallbackUrl'],
            'grant_type'    => 'authorization_code',
        ]);
        $accessToken = $token['access_token'] ?? null;
        if (!is_string($accessToken) || $accessToken === '') {
            throw new RuntimeException('OAuth: kein Access-Token erhalten');
        }

        $info = self::get(self::USERINFO, $accessToken);
        $sub = $info['sub'] ?? null;
        if (!is_string($sub) || $sub === '') {
            throw new RuntimeException('OAuth: kein Profil erhalten');
        }

        return [
            'sub'     => $sub,
            'email'   => (string) ($info['email'] ?? ''),
            'name'    => (string) ($info['name'] ?? ($info['email'] ?? 'Unbekannt')),
            'picture' => isset($info['picture']) && is_string($info['picture']) ? $info['picture'] : null,
        ];
    }

    private static function post(string $url, array $fields): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query($fields),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
        ]);
        return self::exec($ch);
    }

    private static function get(string $url, string $bearer): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $bearer],
        ]);
        return self::exec($ch);
    }

    private static function exec($ch): array
    {
        $body  = curl_exec($ch);
        $errno = curl_errno($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($body === false || $errno !== 0) {
            throw new RuntimeException('OAuth: Netzwerkfehler');
        }
        if ($status >= 400) {
            throw new RuntimeException('OAuth: Google antwortete mit Status ' . $status);
        }
        $decoded = json_decode((string) $body, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('OAuth: ungültige Antwort');
        }
        return $decoded;
    }
}
