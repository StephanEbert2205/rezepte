/**
 * Modal zum Melden eines Problems an einem Rezept.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Flag, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { reportApi, REPORT_CATEGORIES, ReportCategoryId } from '../api/client';

interface Props {
  recipeId: number;
  recipeTitle: string;
  onClose: () => void;
}

export default function ReportModal({ recipeId, recipeTitle, onClose }: Props) {
  const [selected, setSelected] = useState<Set<ReportCategoryId>>(new Set());
  const [comment, setComment]   = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      reportApi.create(recipeId, Array.from(selected) as ReportCategoryId[], comment),
  });

  const toggle = (id: ReportCategoryId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <Flag className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Problem melden</p>
              <p className="text-xs text-gray-400 truncate max-w-[220px]">{recipeTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {mutation.isSuccess ? (
          /* ── Erfolg ── */
          <div className="px-5 py-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-900 mb-1">Meldung eingereicht</p>
            <p className="text-sm text-gray-500 mb-5">
              Danke für deinen Hinweis. Der Admin wird sich darum kümmern.
            </p>
            <button onClick={onClose} className="btn-primary">Schließen</button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">

            {/* Kategorien */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Was stimmt nicht? <span className="text-red-400">*</span>
              </p>
              <div className="space-y-2">
                {REPORT_CATEGORIES.map(({ id, label }) => (
                  <label
                    key={id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors select-none ${
                      selected.has(id)
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={() => toggle(id)}
                      className="rounded border-gray-300 text-red-500 focus:ring-red-400 shrink-0"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Kommentar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Kommentar <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Was genau ist falsch? Welche Zutaten fehlen? …"
                className="input resize-none w-full text-sm"
              />
              {comment.length > 1800 && (
                <p className="text-xs text-gray-400 text-right mt-1">
                  {comment.length}/2000
                </p>
              )}
            </div>

            {/* Fehler */}
            {mutation.isError && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2.5 border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {(mutation.error as { response?: { data?: { error?: string } } })
                    ?.response?.data?.error ?? 'Meldung konnte nicht gesendet werden.'}
                </span>
              </div>
            )}

            {/* Aktionen */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={mutation.isPending}
              >
                Abbrechen
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={selected.size === 0 || mutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {mutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sendet…</>
                  : <><Flag className="w-4 h-4" /> Melden</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
