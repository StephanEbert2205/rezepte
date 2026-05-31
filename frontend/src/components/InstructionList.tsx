import { Instruction } from '../types/recipe';

interface Props {
  instructions: Instruction[];
  cookMode?: boolean;
}

export default function InstructionList({ instructions, cookMode = false }: Props) {
  if (instructions.length === 0) {
    return <p className="text-gray-400 italic text-sm">Keine Zubereitungsschritte vorhanden.</p>;
  }

  return (
    <ol className="space-y-4">
      {instructions.map((inst) => (
        <li key={inst.id} className="flex gap-4">
          <span
            className={`shrink-0 w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center font-semibold ${
              cookMode ? 'text-base w-9 h-9' : 'text-sm'
            }`}
          >
            {inst.stepNumber}
          </span>
          <p className={`text-gray-800 leading-relaxed pt-0.5 ${cookMode ? 'text-lg' : 'text-sm'}`}>
            {inst.content}
          </p>
        </li>
      ))}
    </ol>
  );
}
