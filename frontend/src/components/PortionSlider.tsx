import { Minus, Plus } from 'lucide-react';

interface Props {
  servings: number;
  onChange: (s: number) => void;
  min?: number;
  max?: number;
}

export default function PortionSlider({ servings, onChange, min = 1, max = 50 }: Props) {
  const decrement = () => onChange(Math.max(min, servings - 1));
  const increment = () => onChange(Math.min(max, servings + 1));

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={decrement}
        disabled={servings <= min}
        className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Portionen verringern"
      >
        <Minus className="w-4 h-4" />
      </button>

      <span className="text-lg font-semibold w-8 text-center">{servings}</span>

      <button
        onClick={increment}
        disabled={servings >= max}
        className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Portionen erhöhen"
      >
        <Plus className="w-4 h-4" />
      </button>

      <span className="text-sm text-gray-500">{servings === 1 ? 'Portion' : 'Portionen'}</span>
    </div>
  );
}
