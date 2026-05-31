<?php
declare(strict_types=1);

/** Hilfsfunktionen für JSON-Antworten – spiegelt das Verhalten von Express/res.json. */
final class Response
{
    public static function json($data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(
            $data,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION
        );
        exit;
    }

    public static function error(string $message, int $status = 500, array $extra = []): void
    {
        self::json(array_merge(['error' => $message], $extra), $status);
    }

    public static function noContent(): void
    {
        http_response_code(204);
        exit;
    }

    public static function redirect(string $url): void
    {
        http_response_code(302);
        header('Location: ' . $url);
        exit;
    }
}
