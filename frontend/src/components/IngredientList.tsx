import { Ingredient } from '../types/recipe';
import { scaleAmount } from '../utils/format';

interface Props {
  ingredients: Ingredient[];
  targetServings: number;
  baseServings: number;
}

export default function IngredientList({ ingredients, targetServings, baseServings }: Props) {
  const scaleFactor = baseServings > 0 ? targetServings / baseServings : 1;

  return (
    <ul className="space-y-2">
      {ingredients.map((ing) => {
        const hasAmount = ing.amountPerServing !== null && ing.amountPerServing !== undefined;
        const scaled = hasAmount ? scaleAmount(ing.amountPerServing, targetServings, ing.unitNormalized) : '';
        const unit = ing.unitNormalized || ing.unitOriginal || '';

        let amountDisplay = '';
        if (hasAmount && scaled) {
          amountDisplay = unit ? `${scaled} ${unit}` : scaled;
        } else if (ing.amountOriginal) {
          // Show original scaled by factor
          amountDisplay = ing.amountOriginal;
        }

        return (
          <li
            key={ing.id}
            className={`flex items-start gap-3 py-2 border-b border-gray-50 last:border-0 ${
              ing.optional ? 'opacity-70' : ''
            }`}
          >
            <span className="w-24 shrink-0 text-sm font-medium text-brand-700 text-right tabular-nums">
              {amountDisplay}
            </span>
            <span className="text-sm text-gray-800">
              {ing.name}
              {ing.optional && (
                <span className="ml-1 text-xs text-gray-400">(optional)</span>
              )}
              {ing.notes && (
                <span className="ml-1 text-xs text-gray-400">, {ing.notes}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
