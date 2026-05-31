import { ParsedIngredient } from '../parsers/types';

export function normalizeIngredients(
  ingredients: ParsedIngredient[],
  servings: number,
): {
  amountPerServing: number | undefined;
  unitNormalized: string | undefined;
  normalizedName: string;
}[] {
  return ingredients.map((ing) => {
    const perServing =
      ing.amountNumeric !== undefined && servings > 0
        ? ing.amountNumeric / servings
        : undefined;

    return {
      amountPerServing: perServing,
      unitNormalized: ing.unitOriginal,
      normalizedName: normalizeIngredientName(ing.name),
    };
  });
}

const NAME_NORMALIZATIONS: [RegExp, string][] = [
  [/\b(mehligkochende?|festkochende?|vorwiegend festkochende?)\s+kartoffeln?/i, 'Kartoffeln'],
  [/\bpellkartoffeln?\b/i, 'Kartoffeln'],
  [/\bjungzwiebeln?\b/i, 'Frühlingszwiebeln'],
  [/\bfrühlingszwiebeln?\b/i, 'Frühlingszwiebeln'],
  [/\bschalotten?\b/i, 'Schalotten'],
  [/\bknobi\b/i, 'Knoblauch'],
  [/\bknoblauchzehen?\b/i, 'Knoblauch'],
  [/\bhähnchen(brust|schenkel|fleisch)?\b/i, 'Hähnchen'],
  [/\bhuhn\b/i, 'Hähnchen'],
];

function normalizeIngredientName(name: string): string {
  const lower = name.toLowerCase().trim();
  for (const [pattern, normalized] of NAME_NORMALIZATIONS) {
    if (pattern.test(lower)) return normalized;
  }
  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}
