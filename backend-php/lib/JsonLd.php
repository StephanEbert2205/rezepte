<?php
declare(strict_types=1);

/**
 * Portierung von backend/src/parsers/generic/GenericParser.ts
 *
 * JSON-LD (schema.org/Recipe) zuerst, danach heuristischer HTML-Fallback.
 * Chefkoch und Gutekueche liefern ebenfalls JSON-LD, daher deckt dieser
 * eine Parser die früheren site-spezifischen Parser mit ab.
 */
final class JsonLd
{
    /** @return array<string,mixed> ParsedRecipe */
    public static function parse(string $html, string $url): array
    {
        $sourceDomain = preg_replace('/^www\./', '', (string) (parse_url($url, PHP_URL_HOST) ?? ''));

        $doc = new DOMDocument();
        libxml_use_internal_errors(true);
        // UTF-8 erzwingen
        $doc->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();
        $xpath = new DOMXPath($doc);

        $fromJsonLd = self::parseJsonLd($xpath, $url, $sourceDomain);
        if ($fromJsonLd !== null && count($fromJsonLd['ingredients']) > 0) {
            return $fromJsonLd;
        }

        return self::parseHeuristic($xpath, $url, $sourceDomain);
    }

    private static function parseJsonLd(DOMXPath $xpath, string $url, string $sourceDomain): ?array
    {
        $recipeData = null;
        $scripts = $xpath->query('//script[@type="application/ld+json"]');
        if ($scripts !== false) {
            foreach ($scripts as $script) {
                $content = $script->textContent ?? '';
                if (trim($content) === '') {
                    continue;
                }
                $parsed = json_decode($content, true);
                if ($parsed === null) {
                    continue; // ungültiges JSON-LD ignorieren
                }
                $candidate = self::findRecipeInGraph($parsed);
                if ($candidate !== null) {
                    $recipeData = $candidate;
                }
            }
        }

        if ($recipeData === null) {
            return null;
        }
        return self::extractFromSchemaOrg($recipeData, $url, $sourceDomain);
    }

    private static function findRecipeInGraph($data): ?array
    {
        if (!is_array($data)) {
            return null;
        }
        if (array_is_list($data)) {
            foreach ($data as $item) {
                $found = self::findRecipeInGraph($item);
                if ($found !== null) {
                    return $found;
                }
            }
            return null;
        }
        $type = $data['@type'] ?? null;
        if ($type === 'Recipe' || (is_array($type) && in_array('Recipe', $type, true))) {
            return $data;
        }
        if (isset($data['@graph']) && is_array($data['@graph'])) {
            foreach ($data['@graph'] as $item) {
                $found = self::findRecipeInGraph($item);
                if ($found !== null) {
                    return $found;
                }
            }
        }
        return null;
    }

    private static function extractFromSchemaOrg(array $data, string $url, string $sourceDomain): array
    {
        $nameVal     = self::str($data['name'] ?? null) ?? 'Unbekanntes Rezept';
        $headlineVal = self::str($data['headline'] ?? null);
        // 'headline' bevorzugen wenn kürzer als 'name' — entfernt SEO-Suffixe (z.B. lecker.de)
        $title       = ($headlineVal !== null && mb_strlen($headlineVal) < mb_strlen($nameVal))
            ? $headlineVal
            : $nameVal;
        $description = self::str($data['description'] ?? null);
        $author      = self::extractAuthor($data['author'] ?? null);
        $imageUrl    = self::extractImage($data['image'] ?? null);

        $prepTime  = self::parseTime($data['prepTime'] ?? null);
        $cookTime  = self::parseTime($data['cookTime'] ?? null);
        $totalTime = self::parseTime($data['totalTime'] ?? null);
        if ($totalTime === null && $prepTime !== null && $cookTime !== null) {
            $totalTime = $prepTime + $cookTime;
        }

        $servings = self::extractServings($data['recipeYield'] ?? null);

        $ingredients = [];
        foreach (self::toStringArray($data['recipeIngredient'] ?? null) as $raw) {
            if (trim($raw) !== '') {
                $ingredients[] = Ingredients::parse($raw);
            }
        }

        $instructions = [];
        $step = 1;
        foreach (self::extractInstructions($data['recipeInstructions'] ?? null) as $content) {
            $instructions[] = ['stepNumber' => $step++, 'content' => $content];
        }

        $tags = [];
        foreach (self::toStringArray($data['keywords'] ?? null) as $k) {
            foreach (explode(',', $k) as $part) {
                $part = trim($part);
                if ($part !== '') {
                    $tags[] = $part;
                }
            }
        }
        foreach (self::toStringArray($data['recipeCategory'] ?? null) as $c) {
            if (trim($c) !== '') {
                $tags[] = $c;
            }
        }
        foreach (self::toStringArray($data['recipeCuisine'] ?? null) as $c) {
            if (trim($c) !== '') {
                $tags[] = $c;
            }
        }
        $tags = array_values(array_unique($tags));

        $nutrition = self::extractNutrition($data['nutrition'] ?? null);

        return self::postProcess([
            'title'        => $title,
            'description'  => $description,
            'sourceUrl'    => $url,
            'sourceDomain' => $sourceDomain,
            'servings'     => $servings,
            'prepTime'     => $prepTime,
            'cookTime'     => $cookTime,
            'totalTime'    => $totalTime,
            'imageUrl'     => $imageUrl,
            'author'       => $author,
            'ingredients'  => $ingredients,
            'instructions' => $instructions,
            'tags'         => $tags,
            'nutrition'    => $nutrition,
        ], $sourceDomain);
    }

    /**
     * Site-spezifische Nachbearbeitung des geparsten Rezepts.
     * Behebt bekannte Eigenheiten bestimmter Quellen.
     */
    private static function postProcess(array $result, string $sourceDomain): array
    {
        if (str_contains($sourceDomain, 'lecker.de')) {
            // Markenname "Lecker" als Autor ist nicht sinnvoll
            if (mb_strtolower(trim((string) ($result['author'] ?? ''))) === 'lecker') {
                $result['author'] = null;
            }
            // Generisches SEO-Keyword "Rezepte" aus Tags entfernen
            $result['tags'] = array_values(array_filter(
                $result['tags'],
                static fn(string $t) => mb_strtolower(trim($t)) !== 'rezepte'
            ));
        }
        return $result;
    }

    private static function str($val): ?string
    {
        if (is_string($val)) {
            $t = trim($val);
            return $t !== '' ? $t : null;
        }
        return null;
    }

    private static function parseTime($val): ?int
    {
        if (!is_string($val) || $val === '') {
            return null;
        }
        if ($val[0] === 'P') {
            return TimeParser::iso8601($val);
        }
        return TimeParser::human($val);
    }

    private static function extractAuthor($val): ?string
    {
        if (is_string($val)) {
            return self::str($val);
        }
        if (is_array($val)) {
            if (array_is_list($val)) {
                return isset($val[0]) ? self::extractAuthor($val[0]) : null;
            }
            return isset($val['name']) && is_string($val['name']) ? self::str($val['name']) : null;
        }
        return null;
    }

    private static function extractImage($val): ?string
    {
        if (is_string($val)) {
            return self::str($val);
        }
        if (is_array($val)) {
            if (array_is_list($val)) {
                return isset($val[0]) ? self::extractImage($val[0]) : null;
            }
            return isset($val['url']) ? self::extractImage($val['url']) : null;
        }
        return null;
    }

    private static function extractServings($val): ?int
    {
        if ($val === null || $val === '') {
            return null;
        }
        if (is_int($val)) {
            return $val;
        }
        if (is_float($val)) {
            return (int) $val;
        }
        $str = is_array($val) ? (string) ($val[0] ?? '') : (string) $val;
        if (preg_match('/\d+/', $str, $m)) {
            return (int) $m[0];
        }
        return null;
    }

    /** @return string[] */
    private static function toStringArray($val): array
    {
        if ($val === null) {
            return [];
        }
        if (is_string($val)) {
            return [$val];
        }
        if (is_array($val)) {
            return array_values(array_filter($val, 'is_string'));
        }
        return [];
    }

    /** @return string[] */
    private static function extractInstructions($val): array
    {
        if ($val === null) {
            return [];
        }
        if (is_string($val)) {
            return $val !== '' ? [$val] : [];
        }
        if (is_array($val)) {
            $out = [];
            foreach ($val as $item) {
                if (is_string($item)) {
                    if ($item !== '') {
                        $out[] = $item;
                    }
                    continue;
                }
                if (is_array($item)) {
                    $type = $item['@type'] ?? null;
                    if ($type === 'HowToSection' && isset($item['itemListElement']) && is_array($item['itemListElement'])) {
                        foreach (self::extractInstructions($item['itemListElement']) as $sub) {
                            $out[] = $sub;
                        }
                        continue;
                    }
                    $text = $item['text'] ?? $item['name'] ?? null;
                    if (is_string($text) && $text !== '') {
                        $out[] = $text;
                    }
                }
            }
            return $out;
        }
        return [];
    }

    /** @return array<string,float|null>|null */
    private static function extractNutrition($val): ?array
    {
        if (!is_array($val)) {
            return null;
        }
        $parse = static function ($v): ?float {
            if ($v === null || $v === '') {
                return null;
            }
            if (preg_match('/[\d.,]+/', (string) $v, $m)) {
                $n = (float) str_replace(',', '.', $m[0]);
                return is_nan($n) ? null : $n;
            }
            return null;
        };
        return [
            'calories' => $parse($val['calories'] ?? null),
            'protein'  => $parse($val['proteinContent'] ?? null),
            'fat'      => $parse($val['fatContent'] ?? null),
            'carbs'    => $parse($val['carbohydrateContent'] ?? null),
            'fiber'    => $parse($val['fiberContent'] ?? null),
            'sugar'    => $parse($val['sugarContent'] ?? null),
        ];
    }

    private static function parseHeuristic(DOMXPath $xpath, string $url, string $sourceDomain): array
    {
        $firstText = static function (string $q) use ($xpath): ?string {
            $nodes = $xpath->query($q);
            if ($nodes !== false && $nodes->length > 0) {
                $t = trim($nodes->item(0)->textContent ?? '');
                return $t !== '' ? $t : null;
            }
            return null;
        };
        $attr = static function (string $q) use ($xpath): ?string {
            $nodes = $xpath->query($q);
            if ($nodes !== false && $nodes->length > 0) {
                $v = trim($nodes->item(0)->nodeValue ?? '');
                return $v !== '' ? $v : null;
            }
            return null;
        };

        $title = $firstText('//h1')
            ?? $attr('//meta[@property="og:title"]/@content')
            ?? $firstText('//title')
            ?? 'Unbekanntes Rezept';

        $imageUrl = $attr('//meta[@property="og:image"]/@content')
            ?? $attr('//img[@itemprop="image"]/@src');

        $description = $attr('//meta[@property="og:description"]/@content');

        return [
            'title'        => $title,
            'description'  => $description,
            'sourceUrl'    => $url,
            'sourceDomain' => $sourceDomain,
            'servings'     => null,
            'prepTime'     => null,
            'cookTime'     => null,
            'totalTime'    => null,
            'imageUrl'     => $imageUrl,
            'author'       => null,
            'ingredients'  => [],
            'instructions' => [],
            'tags'         => [],
            'nutrition'    => null,
        ];
    }
}
