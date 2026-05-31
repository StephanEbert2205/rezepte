import { ChevronUp, ChevronDown, X, Plus, RotateCcw } from 'lucide-react';
import { CustomIngredient, Ingredient } from '../types/recipe';

interface Props {
  ingredients: CustomIngredient[];
  onChange: (ingredients: CustomIngredient[]) => void;
  originalIngredients: Ingredient[];
}

const EMPTY_ROW: CustomIngredient = { name: '', amount: '', unit: '', notes: '', optional: false };

export default function CustomIngredientEditor({ ingredients, onChange, originalIngredients }: Props) {
  function update(i: number, field: keyof CustomIngredient, value: string | boolean) {
    const next = [...ingredients];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  }

  function addRow() {
    onChange([...ingredients, { ...EMPTY_ROW }]);
  }

  function remove(i: number) {
    onChange(ingredients.filter((_, idx) => idx !== i));
  }

  function move(i: number, dir: -1 | 1) {
    const next = [...ingredients];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function copyFromOriginal() {
    onChange(
      originalIngredients.map((ing) => ({
        name: ing.name,
        amount: ing.amountOriginal ?? '',
        unit: ing.unitOriginal ?? ing.unitNormalized ?? '',
        notes: ing.notes ?? '',
        optional: ing.optional,
      })),
    );
  }

  return (
    <div>
      {ingredients.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm mb-3">Noch keine eigenen Zutaten angelegt.</p>
          <div className="flex justify-center gap-2 flex-wrap">
            <button type="button" onClick={addRow} className="btn-secondary text-sm">
              <Plus className="w-3.5 h-3.5" /> Zutat hinzufügen
            </button>
            {originalIngredients.length > 0 && (
              <button type="button" onClick={copyFromOriginal} className="btn-secondary text-sm">
                <RotateCcw className="w-3.5 h-3.5" /> Von Originalzutaten übernehmen
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div className="hidden sm:flex gap-1.5 px-2 mb-1 text-xs text-gray-400 font-medium">
            <span className="w-16">Menge</span>
            <span className="w-16">Einheit</span>
            <span className="flex-1">Zutat</span>
            <span className="w-28">Notiz</span>
            <span className="w-8 text-center">opt.</span>
            <span className="w-16" />
          </div>

          <div className="space-y-1.5">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 bg-gray-50 rounded-lg p-2">
                <input
                  value={ing.amount}
                  onChange={(e) => update(i, 'amount', e.target.value)}
                  className="input !py-1 text-sm w-16 px-2"
                  placeholder="Menge"
                />
                <input
                  value={ing.unit}
                  onChange={(e) => update(i, 'unit', e.target.value)}
                  className="input !py-1 text-sm w-16 px-2"
                  placeholder="Einheit"
                />
                <input
                  value={ing.name}
                  onChange={(e) => update(i, 'name', e.target.value)}
                  className="input !py-1 text-sm flex-1 min-w-32 px-2"
                  placeholder="Zutat *"
                />
                <input
                  value={ing.notes}
                  onChange={(e) => update(i, 'notes', e.target.value)}
                  className="input !py-1 text-sm w-28 px-2"
                  placeholder="Notiz"
                />
                <label className="flex items-center justify-center w-8 cursor-pointer" title="Optional">
                  <input
                    type="checkbox"
                    checked={ing.optional}
                    onChange={(e) => update(i, 'optional', e.target.checked)}
                    className="rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                  />
                </label>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-25 rounded"
                    title="Nach oben"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === ingredients.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-25 rounded"
                    title="Nach unten"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                    title="Entfernen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <button type="button" onClick={addRow} className="btn-secondary text-sm">
              <Plus className="w-3.5 h-3.5" /> Zutat hinzufügen
            </button>
            {originalIngredients.length > 0 && (
              <button type="button" onClick={copyFromOriginal} className="btn-secondary text-sm">
                <RotateCcw className="w-3.5 h-3.5" /> Auf Original zurücksetzen
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-sm text-gray-400 hover:text-red-500 ml-auto"
            >
              Alle löschen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
