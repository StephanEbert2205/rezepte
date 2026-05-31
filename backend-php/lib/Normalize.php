<?php
declare(strict_types=1);

/** Portierung von backend/src/services/NormalizationService.ts */
final class Normalize
{
    /** @var array<array{0:string,1:string}> [regex, ersatz] */
    private const NAME_NORMALIZATIONS = [
        ['/\b(mehligkochende?|festkochende?|vorwiegend festkochende?)\s+kartoffeln?/iu', 'Kartoffeln'],
        ['/\bpellkartoffeln?\b/iu', 'Kartoffeln'],
        ['/\bjungzwiebeln?\b/iu', 'Frühlingszwiebeln'],
        ['/\bfrühlingszwiebeln?\b/iu', 'Frühlingszwiebeln'],
        ['/\bschalotten?\b/iu', 'Schalotten'],
        ['/\bknobi\b/iu', 'Knoblauch'],
        ['/\bknoblauchzehen?\b/iu', 'Knoblauch'],
        ['/\bhähnchen(brust|schenkel|fleisch)?\b/iu', 'Hähnchen'],
        ['/\bhuhn\b/iu', 'Hähnchen'],
    ];

    public static function ingredientName(string $name): string
    {
        $lower = mb_strtolower(trim($name));
        foreach (self::NAME_NORMALIZATIONS as [$pattern, $replacement]) {
            if (preg_match($pattern, $lower)) {
                return $replacement;
            }
        }
        // Ersten Buchstaben groß schreiben (multibyte-sicher)
        if ($name === '') {
            return $name;
        }
        $first = mb_strtoupper(mb_substr($name, 0, 1));
        return $first . mb_substr($name, 1);
    }

    /**
     * Berechnet pro Zutat amountPerServing / unitNormalized / normalizedName.
     * @param array $ingredients Liste von ParsedIngredient (assoziative Arrays)
     * @return array<int,array{amountPerServing: float|null, unitNormalized: ?string, normalizedName: string}>
     */
    public static function ingredients(array $ingredients, int $servings): array
    {
        $result = [];
        foreach ($ingredients as $ing) {
            $perServing = null;
            if (isset($ing['amountNumeric']) && $ing['amountNumeric'] !== null && $servings > 0) {
                $perServing = $ing['amountNumeric'] / $servings;
            }
            $result[] = [
                'amountPerServing' => $perServing,
                'unitNormalized'   => $ing['unitOriginal'] ?? null,
                'normalizedName'   => self::ingredientName($ing['name'] ?? ''),
            ];
        }
        return $result;
    }
}
