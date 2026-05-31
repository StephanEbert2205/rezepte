import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { recipeApi } from '../api/client';

const EXAMPLE_URLS = [
  'https://www.chefkoch.de/rezepte/...',
  'https://www.gutekueche.de/...',
  'https://www.bbcgoodfood.com/recipes/...',
  'https://www.allrecipes.com/recipe/...',
];

type Status = 'idle' | 'loading' | 'success' | 'duplicate' | 'error';

export default function ImportPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [recipeId, setRecipeId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setStatus('loading');
    setMessage('');

    try {
      const result = await recipeApi.import(url.trim());
      setRecipeId(result.id);
      setStatus('success');
      setMessage('Rezept erfolgreich importiert!');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number; data?: { error?: string; existingId?: number } } };
      if (axiosErr.response?.status === 409) {
        setStatus('duplicate');
        setRecipeId(axiosErr.response.data?.existingId ?? null);
        setMessage('Dieses Rezept ist bereits in deiner Sammlung.');
      } else {
        setStatus('error');
        setMessage(
          axiosErr.response?.data?.error ?? 'Import fehlgeschlagen. Bitte URL prüfen.',
        );
      }
    }
  };

  const reset = () => {
    setUrl('');
    setStatus('idle');
    setMessage('');
    setRecipeId(null);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Rezept importieren</h1>
        <p className="mt-2 text-gray-500">
          Füge die URL eines Rezepts ein. Wir extrahieren automatisch alle Informationen.
        </p>
      </div>

      {status === 'idle' || status === 'loading' || status === 'error' ? (
        <form onSubmit={handleSubmit} className="card p-6">
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
            Rezept-URL
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.chefkoch.de/rezepte/..."
                className="input pl-9"
                disabled={status === 'loading'}
                required
              />
            </div>
            <button
              type="submit"
              disabled={status === 'loading' || !url.trim()}
              className="btn-primary shrink-0"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importiere...
                </>
              ) : (
                'Importieren'
              )}
            </button>
          </div>

          {status === 'error' && message && (
            <div className="mt-3 flex items-start gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          <div className="mt-6">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Unterstützte Quellen
            </p>
            <div className="grid grid-cols-2 gap-2">
              {['Chefkoch', 'GuteKüche', 'BBC Good Food', 'Allrecipes', 'Essen & Trinken', 'Küchengötter'].map(
                (site) => (
                  <div key={site} className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    {site}
                  </div>
                ),
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                Alle Seiten mit Schema.org
              </div>
            </div>
          </div>
        </form>
      ) : null}

      {(status === 'success' || status === 'duplicate') && (
        <div className="card p-6">
          <div className="flex items-start gap-3">
            <CheckCircle
              className={`w-6 h-6 shrink-0 ${status === 'success' ? 'text-green-500' : 'text-yellow-500'}`}
            />
            <div>
              <p className="font-medium text-gray-900">
                {status === 'success' ? 'Erfolgreich importiert!' : 'Bereits vorhanden'}
              </p>
              <p className="text-sm text-gray-500 mt-1">{message}</p>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            {recipeId && (
              <button
                onClick={() => navigate(`/rezepte/${recipeId}`)}
                className="btn-primary"
              >
                Rezept ansehen
              </button>
            )}
            <button onClick={reset} className="btn-secondary">
              Weiteres importieren
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 card p-5 bg-brand-50 border-brand-100">
        <p className="text-sm font-medium text-brand-800 mb-1">Hinweis</p>
        <p className="text-sm text-brand-700">
          Der Import funktioniert am besten mit Seiten, die strukturierte Rezeptdaten (Schema.org)
          verwenden. Die meisten bekannten Rezeptseiten unterstützen dies.
        </p>
      </div>
    </div>
  );
}
