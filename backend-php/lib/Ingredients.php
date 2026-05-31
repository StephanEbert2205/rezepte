<?php
declare(strict_types=1);

/**
 * Portierung von backend/src/parsers/IngredientParser.ts
 * Liefert assoziative Arrays mit denselben Feldern wie ParsedIngredient:
 *   raw, name, amountOriginal?, unitOriginal?, amountNumeric?, optional, notes?
 */
final class Ingredients
{
    /** @var array<string,float> */
    private const UNICODE_FRACTIONS = [
        '½' => 0.5, '¼' => 0.25, '¾' => 0.75,
        '⅓' => 0.3333333333333333, '⅔' => 0.6666666666666666,
        '⅛' => 0.125, '⅜' => 0.375, '⅝' => 0.625, '⅞' => 0.875,
        '⅙' => 0.16666666666666666, '⅚' => 0.8333333333333334,
    ];

    /** @var array<string,string> */
    private const UNIT_ALIASES = [
        'el' => 'EL', 'esslöffel' => 'EL', 'esslöffeln' => 'EL', 'esslöffel.' => 'EL',
        'tl' => 'TL', 'teelöffel' => 'TL', 'teelöffeln' => 'TL', 'teelöffel.' => 'TL',
        'g' => 'g', 'gr' => 'g', 'gramm' => 'g',
        'kg' => 'kg', 'kilogramm' => 'kg',
        'ml' => 'ml', 'milliliter' => 'ml', 'milliliters' => 'ml',
        'l' => 'l', 'liter' => 'l', 'lt' => 'l',
        'dl' => 'dl', 'deziliter' => 'dl',
        'cl' => 'cl', 'zentiliter' => 'cl',
        'prise' => 'Prise', 'prisen' => 'Prise', 'priesen' => 'Prise',
        'msp' => 'Msp.', 'msp.' => 'Msp.',
        'bund' => 'Bund', 'bünde' => 'Bund',
        'zehe' => 'Zehe', 'zehen' => 'Zehen',
        'stück' => 'Stück', 'stk' => 'Stück', 'stk.' => 'Stück',
        'dose' => 'Dose', 'dosen' => 'Dosen',
        'glas' => 'Glas', 'gläser' => 'Glas',
        'becher' => 'Becher',
        'paket' => 'Paket', 'pakete' => 'Paket', 'pkt' => 'Paket', 'pkt.' => 'Paket',
        'päckchen' => 'Päckchen',
        'tasse' => 'Tasse', 'tassen' => 'Tasse',
        'handvoll' => 'Handvoll',
        'scheibe' => 'Scheibe', 'scheiben' => 'Scheiben',
        'zweig' => 'Zweig', 'zweige' => 'Zweige',
        'blatt' => 'Blatt', 'blätter' => 'Blätter',
        'tropfen' => 'Tropfen',
    ];

    private const OPTIONAL_PHRASES = ['optional', 'nach belieben', 'nach geschmack', 'nach wunsch'];

    private const FREE_TEXT_PATTERNS = [
        '/^(etwas|wenig|reichlich|nach geschmack|nach belieben|nach wunsch|zum abschmecken)/iu',
        '/^(salz und pfeffer|salz|pfeffer)\s*(und|&)?\s*(pfeffer|salz)?(\s+nach.*)?$/iu',
    ];

    private const FRACTION_CLASS = '½¼¾⅓⅔⅛⅜⅝⅞⅙⅚';

    private static function parseFraction(string $text): ?float
    {
        $trimmed = trim($text);

        if (isset(self::UNICODE_FRACTIONS[$trimmed])) {
            return self::UNICODE_FRACTIONS[$trimmed];
        }

        // Slash-Bruch: "1/2"
        if (preg_match('/^(\d+)\s*\/\s*(\d+)$/', $trimmed, $m)) {
            return (int) $m[1] / (int) $m[2];
        }

        // Gemischte Zahl: "1½", "2 ½", "1 1/2"
        if (preg_match('/^(\d+)\s*([' . self::FRACTION_CLASS . ']|(\d+)\/(\d+))?$/u', $trimmed, $m)) {
            $whole = (int) $m[1];
            if (!empty($m[2])) {
                if (isset(self::UNICODE_FRACTIONS[$m[2]])) {
                    $frac = self::UNICODE_FRACTIONS[$m[2]];
                } elseif (!empty($m[3]) && !empty($m[4])) {
                    $frac = (int) $m[3] / (int) $m[4];
                } else {
                    $frac = 0;
                }
                return $whole + $frac;
            }
            return (float) $whole;
        }

        // Reine Dezimalzahl
        $decimal = self::toFloat($trimmed);
        if ($decimal !== null) {
            return $decimal;
        }
        return null;
    }

    /** @return array{amount: float, raw: string}|null */
    private static function parseAmount(string $token): ?array
    {
        $cleaned = trim($token);

        // Bereich "2-3" → Mittelwert
        if (preg_match('/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/u', $cleaned, $m)) {
            $lo = (float) str_replace(',', '.', $m[1]);
            $hi = (float) str_replace(',', '.', $m[2]);
            return ['amount' => ($lo + $hi) / 2, 'raw' => $cleaned];
        }

        // Gemischter Bruch "1 1/2", "2 ½"
        if (preg_match('/^(\d+)\s+([' . self::FRACTION_CLASS . ']|\d+\/\d+)$/u', $cleaned, $m)) {
            $whole = (int) $m[1];
            $frac  = self::parseFraction($m[2]);
            if ($frac !== null) {
                return ['amount' => $whole + $frac, 'raw' => $cleaned];
            }
        }

        // Unicode-Bruch allein oder mit Präfix
        foreach (self::UNICODE_FRACTIONS as $char => $val) {
            if ($cleaned === $char) {
                return ['amount' => $val, 'raw' => $cleaned];
            }
            if (str_ends_with($cleaned, $char)) {
                $prefix = trim(mb_substr($cleaned, 0, mb_strlen($cleaned) - mb_strlen($char)));
                $whole  = self::toFloat($prefix);
                if ($whole !== null) {
                    return ['amount' => $whole + $val, 'raw' => $cleaned];
                }
            }
        }

        // Slash-Bruch
        if (preg_match('/^(\d+)\s*\/\s*(\d+)$/', $cleaned, $m)) {
            return ['amount' => (int) $m[1] / (int) $m[2], 'raw' => $cleaned];
        }

        // Reine Zahl – nur wenn der ganze Token numerisch ist
        if (preg_match('/^\d[\d.,]*$/', $cleaned)) {
            $num = self::toFloat($cleaned);
            if ($num !== null) {
                return ['amount' => $num, 'raw' => $cleaned];
            }
        }

        return null;
    }

    private static function toFloat(string $s): ?float
    {
        $s = str_replace(',', '.', trim($s));
        if ($s === '' || !is_numeric($s)) {
            return null;
        }
        return (float) $s;
    }

    private static function normalizeUnit(string $raw): string
    {
        $lower = mb_strtolower(trim($raw));
        return self::UNIT_ALIASES[$lower] ?? trim($raw);
    }

    /** @return array<string,mixed> */
    public static function parse(string $raw): array
    {
        $trimmed = trim($raw);

        // Freitext-Muster (keine Mengen-Analyse)
        foreach (self::FREE_TEXT_PATTERNS as $pattern) {
            if (preg_match($pattern, $trimmed)) {
                return ['raw' => $trimmed, 'name' => $trimmed, 'optional' => false];
            }
        }

        $lowerTrimmed = mb_strtolower($trimmed);
        $optional = false;
        foreach (self::OPTIONAL_PHRASES as $p) {
            if (str_contains($lowerTrimmed, $p)) {
                $optional = true;
                break;
            }
        }

        $tokens = preg_split('/\s+/u', $trimmed) ?: [];
        $tokenCount = count($tokens);

        $amountResult = null;
        $amountRaw = '';
        $tokenIndex = 0;

        for ($len = min(3, $tokenCount); $len >= 1; $len--) {
            $candidate = implode(' ', array_slice($tokens, 0, $len));
            $amountResult = self::parseAmount($candidate);
            if ($amountResult !== null) {
                $amountRaw = $amountResult['raw'];
                $tokenIndex = $len;
                break;
            }
        }

        if ($amountResult === null || $tokenIndex >= $tokenCount) {
            $res = ['raw' => $trimmed, 'name' => $trimmed, 'optional' => $optional];
            if ($amountRaw !== '') {
                $res['amountOriginal'] = $amountRaw;
            }
            return $res;
        }

        // Einheit aus nächstem Token
        $unit = null;
        $unitTokenIndex = $tokenIndex;
        $nextToken = $tokens[$tokenIndex] ?? null;
        if ($nextToken !== null) {
            $key = mb_strtolower(trim($nextToken));
            if (isset(self::UNIT_ALIASES[$key])) {
                $unit = self::normalizeUnit($nextToken);
                $unitTokenIndex = $tokenIndex + 1;
            }
        }

        $nameTokens = array_slice($tokens, $unitTokenIndex);
        $name = trim(implode(' ', $nameTokens));
        if ($name === '') {
            $name = $trimmed;
        }

        $finalName = $name;
        $notes = null;

        // Notiz aus Klammern: "Mehl (Type 550)"
        if (preg_match('/^(.*?)\s*\(([^)]+)\)\s*$/u', $finalName, $m)) {
            $finalName = trim($m[1]);
            $candidateNote = trim($m[2]);
            $notes = $candidateNote !== '' ? $candidateNote : null;
        }

        // Notiz nach Komma: "Butter, weich"
        $commaIdx = mb_strpos($finalName, ',');
        if ($commaIdx !== false && $commaIdx > 0) {
            $commaNote = trim(mb_substr($finalName, $commaIdx + 1));
            if ($commaNote !== '') {
                $notes = $notes !== null ? $commaNote . ', ' . $notes : $commaNote;
            }
            $finalName = trim(mb_substr($finalName, 0, $commaIdx));
        }

        $result = [
            'raw'            => $trimmed,
            'name'           => $finalName,
            'amountOriginal' => $amountRaw,
            'amountNumeric'  => $amountResult['amount'],
            'optional'       => $optional,
        ];
        if ($unit !== null) {
            $result['unitOriginal'] = $unit;
        }
        if ($notes !== null) {
            $result['notes'] = $notes;
        }
        return $result;
    }
}
