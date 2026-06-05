<?php
declare(strict_types=1);

/** Portierung von backend/src/services/FetchService.ts (SSRF-Schutz + HTML-Abruf). */
final class Fetch
{
    private const PRIVATE_IP_PATTERNS = [
        '/^127\./',
        '/^10\./',
        '/^172\.(1[6-9]|2\d|3[01])\./',
        '/^192\.168\./',
        '/^::1$/',
        '/^fd[0-9a-f]{2}:/i',
        '/^localhost$/i',
    ];

    /** Wirft RuntimeException mit identischen Meldungen wie das Node-Backend. */
    public static function validatePublicUrl(string $url): void
    {
        $parsed = parse_url($url);
        if ($parsed === false || empty($parsed['scheme']) || empty($parsed['host'])) {
            throw new RuntimeException('Ungültige URL');
        }
        $scheme = strtolower($parsed['scheme']);
        if ($scheme !== 'http' && $scheme !== 'https') {
            throw new RuntimeException('Nur HTTP und HTTPS URLs sind erlaubt');
        }
        $host = $parsed['host'];
        foreach (self::PRIVATE_IP_PATTERNS as $pattern) {
            if (preg_match($pattern, $host)) {
                throw new RuntimeException('Private oder lokale URLs sind nicht erlaubt');
            }
        }
    }

    public static function html(string $url, int $timeout, int $maxSize): string
    {
        self::validatePublicUrl($url);

        $buffer = '';
        $tooLarge = false;

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 5,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => $timeout,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_ENCODING       => '',   // gzip/deflate/br automatisch dekodieren
            CURLOPT_HTTPHEADER     => [
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
                'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language: de-DE,de;q=0.9,en;q=0.8',
            ],
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_WRITEFUNCTION  => function ($ch, $data) use (&$buffer, &$tooLarge, $maxSize) {
                $buffer .= $data;
                if (strlen($buffer) > $maxSize) {
                    $tooLarge = true;
                    return 0; // cURL abbrechen
                }
                return strlen($data);
            },
        ]);

        $ok     = curl_exec($ch);
        $errno  = curl_errno($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($tooLarge) {
            throw new RuntimeException('Antwort zu groß');
        }
        if ($ok === false && $errno !== 0) {
            throw new RuntimeException('Seite konnte nicht geladen werden');
        }
        if ($status >= 400) {
            throw new RuntimeException('Seite antwortete mit Status ' . $status);
        }
        return $buffer;
    }
}
