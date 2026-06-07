<?php
declare(strict_types=1);

/**
 * Extrahiert Rezeptdaten aus einem Foto via Google Gemini Vision API.
 */
final class ImageParser
{
    private const GEMINI_HOST  = 'generativelanguage.googleapis.com';
    private const MODEL        = 'gemini-2.5-flash-lite';
    private const MAX_BYTES    = 5 * 1024 * 1024;   // 5 MB Upload-Limit
    private const RESIZE_PX    = 1400;               // max. Kantenlänge für KI
    private const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    // ── Öffentliche API ──────────────────────────────────────────────────────

    /**
     * @param  array  $file      Ein Eintrag aus $_FILES
     * @param  string $apiKey    Gemini-API-Schlüssel
     * @return array             Strukturierte Rezeptdaten (kompatibel mit Validator::createBody)
     * @throws RuntimeException  Bei Konfigurationsfehlern, Validierungsfehlern oder API-Fehlern
     */
    public static function parse(array $file, string $apiKey): array
    {
        if ($apiKey === '') {
            throw new RuntimeException('KI-Bildanalyse nicht konfiguriert (fehlender API-Schlüssel)');
        }
        if (!isset($file['tmp_name'], $file['type'], $file['size'])) {
            throw new RuntimeException('Kein Bild empfangen');
        }
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new RuntimeException('Upload fehlgeschlagen (Fehlercode ' . $file['error'] . ')');
        }
        if (!in_array($file['type'], self::ALLOWED_MIME, true)) {
            throw new RuntimeException('Nicht unterstütztes Bildformat – bitte JPG, PNG oder WEBP verwenden');
        }
        if ($file['size'] > self::MAX_BYTES) {
            throw new RuntimeException('Bild zu groß (max. 5 MB)');
        }

        [$bytes, $mime] = self::loadAndResize($file['tmp_name'], $file['type']);
        $raw = self::callGemini($apiKey, base64_encode($bytes), $mime);
        return self::parseResponse($raw);
    }

    // ── Internes ─────────────────────────────────────────────────────────────

    /**
     * Lädt und skaliert das Bild (via GD) wenn es zu groß ist.
     * @return array{0:string,1:string}  [bytes, mediaType]
     */
    private static function loadAndResize(string $tmpPath, string $mimeType): array
    {
        if (!function_exists('imagecreatefromstring') || filesize($tmpPath) <= 600_000) {
            return [file_get_contents($tmpPath), $mimeType];
        }

        $src = @imagecreatefromstring(file_get_contents($tmpPath));
        if ($src === false) {
            return [file_get_contents($tmpPath), $mimeType];
        }

        $w = imagesx($src);
        $h = imagesy($src);
        $max = self::RESIZE_PX;

        if ($w <= $max && $h <= $max) {
            imagedestroy($src);
            return [file_get_contents($tmpPath), $mimeType];
        }

        if ($w >= $h) {
            $nw = $max; $nh = (int) round($h * $max / $w);
        } else {
            $nh = $max; $nw = (int) round($w * $max / $h);
        }

        $dst = imagecreatetruecolor($nw, $nh);
        // Alpha-Kanal (PNG) erhalten
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
        imagedestroy($src);

        ob_start();
        imagejpeg($dst, null, 88);
        $bytes = ob_get_clean();
        imagedestroy($dst);

        return [$bytes, 'image/jpeg'];
    }

    private static function callGemini(string $apiKey, string $base64, string $mime): string
    {
        $prompt = <<<'PROMPT'
Extract the complete recipe from this image. Return ONLY a valid JSON object — no markdown, no code fences, no explanation.

Use exactly this structure (omit numeric/boolean fields you cannot determine):
{
  "title": "Recipe name",
  "description": "Short description or null",
  "servingsOriginal": 4,
  "prepTime": 15,
  "cookTime": 30,
  "totalTime": 45,
  "isVegetarian": false,
  "isVegan": false,
  "isGlutenFree": false,
  "isLactoseFree": false,
  "tags": ["tag1", "tag2"],
  "ingredients": [
    {"name": "Flour", "amount": "200", "unit": "g", "optional": false, "notes": ""}
  ],
  "instructions": [
    {"content": "Step description"}
  ]
}

Rules:
- All times are integers (minutes). Omit if not found.
- Amounts are always strings ("200", "2", "1/2", or "" if unknown).
- Use empty string for missing amount, unit, or notes.
- Preserve the original language of the recipe.
- If this image does not contain a recipe, return {"title":"","ingredients":[],"instructions":[]}.
PROMPT;

        $url = sprintf(
            'https://%s/v1beta/models/%s:generateContent?key=%s',
            self::GEMINI_HOST,
            self::MODEL,
            $apiKey
        );

        $payload = json_encode([
            'contents' => [[
                'parts' => [
                    [
                        'inline_data' => [
                            'mime_type' => $mime,
                            'data'      => $base64,
                        ],
                    ],
                    ['text' => $prompt],
                ],
            ]],
            'generationConfig' => [
                'maxOutputTokens' => 2048,
                'temperature'     => 0.1,   // niedrig → deterministische JSON-Ausgabe
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 50,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $result   = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($result === false) {
            throw new RuntimeException('Verbindung zur KI fehlgeschlagen: ' . $curlErr);
        }
        if ($httpCode === 401 || $httpCode === 403) {
            throw new RuntimeException('Gemini-API-Schlüssel ungültig oder abgelaufen');
        }
        if ($httpCode === 429) {
            throw new RuntimeException('KI-Dienst: Anfragelimit erreicht – bitte kurz warten');
        }
        if ($httpCode !== 200) {
            $msg = json_decode($result, true)['error']['message'] ?? ('HTTP ' . $httpCode);
            throw new RuntimeException('KI-Dienst nicht verfügbar: ' . $msg);
        }

        $body = json_decode($result, true);
        return $body['candidates'][0]['content']['parts'][0]['text'] ?? '';
    }

    private static function parseResponse(string $raw): array
    {
        // JSON aus Antwort extrahieren (ignoriert ggf. versehentliche Markdown-Backticks)
        if (preg_match('/\{[\s\S]+\}/u', $raw, $m)) {
            $raw = $m[0];
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new RuntimeException('Kein Rezept im Bild erkannt – bitte ein klareres Foto versuchen');
        }
        if (trim((string) ($data['title'] ?? '')) === ''
            && count($data['ingredients'] ?? []) === 0
            && count($data['instructions'] ?? []) === 0) {
            throw new RuntimeException('Kein Rezept im Bild erkannt – bitte ein klareres Foto versuchen');
        }

        // Zutaten normalisieren
        $ingredients = [];
        foreach (($data['ingredients'] ?? []) as $ing) {
            if (!is_array($ing) || trim((string) ($ing['name'] ?? '')) === '') {
                continue;
            }
            $ingredients[] = [
                'name'     => trim((string) $ing['name']),
                'amount'   => (string) ($ing['amount'] ?? ''),
                'unit'     => (string) ($ing['unit']   ?? ''),
                'optional' => !empty($ing['optional']),
                'notes'    => (string) ($ing['notes']  ?? ''),
            ];
        }

        // Schritte normalisieren
        $instructions = [];
        foreach (($data['instructions'] ?? []) as $step) {
            $content = is_array($step)
                ? trim((string) ($step['content'] ?? ''))
                : trim((string) $step);
            if ($content !== '') {
                $instructions[] = ['content' => $content];
            }
        }

        return [
            'title'            => trim((string) ($data['title'] ?? '')),
            'description'      => trim((string) ($data['description'] ?? '')) ?: null,
            'servingsOriginal' => isset($data['servingsOriginal']) && (int) $data['servingsOriginal'] > 0
                                    ? (int) $data['servingsOriginal'] : null,
            'prepTime'         => isset($data['prepTime'])  && (int) $data['prepTime']  >= 0
                                    ? (int) $data['prepTime']  : null,
            'cookTime'         => isset($data['cookTime'])  && (int) $data['cookTime']  >= 0
                                    ? (int) $data['cookTime']  : null,
            'totalTime'        => isset($data['totalTime']) && (int) $data['totalTime'] >= 0
                                    ? (int) $data['totalTime'] : null,
            'isVegetarian'     => !empty($data['isVegetarian']),
            'isVegan'          => !empty($data['isVegan']),
            'isGlutenFree'     => !empty($data['isGlutenFree']),
            'isLactoseFree'    => !empty($data['isLactoseFree']),
            'tags'             => array_values(array_filter(
                                    array_map('trim', (array) ($data['tags'] ?? []))
                                  )),
            'ingredients'      => $ingredients,
            'instructions'     => $instructions,
        ];
    }
}
