/**
 * Öffentliche Vorschau für ein geteiltes Rezept (per Token-Link).
 * Erreichbar ohne Login – zum Kopieren ist ein Account nötig.
 */
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BookOpen, Clock, ChefHat, ExternalLink, Copy, Flame, Leaf, LogIn } from 'lucide-react';
import { recipeApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { formatDuration } from '../utils/format';

export default function SharedRecipePage() {
  const { token } = useParams<{ token: string }>();
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const { data: recipe, isLoading, isError } = useQuery({
    queryKey: ['shared-recipe', token],
    queryFn:  () => recipeApi.getSharedRecipe(token!),
    enabled:  !!token,
  });

  const forkMutation = useMutation({
    mutationFn: () => recipeApi.forkSharedRecipe(token!),
    onSuccess:  (d) => navigate(`/rezepte/${d.id}`),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !recipe) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm text-center">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h1 className="font-semibold text-gray-800 mb-2">Link ungültig</h1>
          <p className="text-sm text-gray-500 mb-6">
            Dieser Freigabelink ist abgelaufen oder wurde widerrufen.
          </p>
          <Link to="/" className="btn-primary justify-center">Zur Startseite</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mini-Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-gray-900 hover:text-brand-600 transition-colors">
            <BookOpen className="w-5 h-5 text-brand-500" />
            <span>Rezeptsammlung</span>
          </Link>
          {!user && (
            <a href="/api/auth/google" className="btn-secondary text-sm">
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Anmelden</span>
            </a>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Banner: geteiltes Rezept */}
        <div className="mb-5 p-4 bg-brand-50 border border-brand-100 rounded-xl flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-brand-800">
              📤 Geteiltes Rezept
            </p>
            <p className="text-sm text-brand-700 mt-0.5">
              {user
                ? 'Speichere eine Kopie in deine persönliche Rezeptsammlung.'
                : 'Melde dich an, um eine Kopie in deine Rezeptsammlung zu speichern.'}
            </p>
          </div>
          {user ? (
            <button
              onClick={() => forkMutation.mutate()}
              disabled={forkMutation.isPending}
              className="btn-primary shrink-0"
            >
              <Copy className="w-4 h-4" />
              {forkMutation.isPending ? 'Kopiere…' : 'In meine Sammlung kopieren'}
            </button>
          ) : (
            <a
              href={`/api/auth/google?redirect=/teilen/${token}`}
              className="btn-primary shrink-0"
            >
              <LogIn className="w-4 h-4" />
              Anmelden &amp; kopieren
            </a>
          )}
        </div>

        {/* Bild */}
        {recipe.imageUrl && (
          <div className="aspect-[16/7] rounded-xl overflow-hidden mb-6 bg-gray-100">
            <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Titel & Badges */}
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{recipe.title}</h1>

        <div className="flex flex-wrap gap-2 mb-4">
          {recipe.isVegan && (
            <span className="flex items-center gap-1 tag-chip bg-green-50 text-green-700 border-green-100">
              <Leaf className="w-3 h-3" /> Vegan
            </span>
          )}
          {recipe.isVegetarian && !recipe.isVegan && (
            <span className="flex items-center gap-1 tag-chip bg-green-50 text-green-700 border-green-100">
              <Leaf className="w-3 h-3" /> Vegetarisch
            </span>
          )}
          {recipe.isGlutenFree && <span className="tag-chip bg-yellow-50 text-yellow-700 border-yellow-100">Glutenfrei</span>}
          {recipe.tags.map(({ tag }) => (
            <span key={tag.id} className="tag-chip">{tag.name}</span>
          ))}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6 pb-6 border-b border-gray-100">
          {recipe.prepTime && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-400" />
              <span><span className="font-medium">Vorbereitung:</span> {formatDuration(recipe.prepTime)}</span>
            </div>
          )}
          {recipe.cookTime && (
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-gray-400" />
              <span><span className="font-medium">Kochzeit:</span> {formatDuration(recipe.cookTime)}</span>
            </div>
          )}
          {recipe.totalTime && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-brand-400" />
              <span><span className="font-medium">Gesamt:</span> {formatDuration(recipe.totalTime)}</span>
            </div>
          )}
          {recipe.author && (
            <div className="flex items-center gap-1.5">
              <ChefHat className="w-4 h-4 text-gray-400" />
              <span>{recipe.author}</span>
            </div>
          )}
          {recipe.sourceUrl && (
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-brand-600 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" />
              Original-Rezept
            </a>
          )}
        </div>

        {recipe.description && (
          <p className="text-gray-600 mb-6 leading-relaxed">{recipe.description}</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Zutaten */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Zutaten
              {recipe.servingsOriginal && (
                <span className="ml-2 text-sm font-normal text-gray-400">
                  ({recipe.servingsOriginal} Portionen)
                </span>
              )}
            </h2>
            {recipe.ingredients.length > 0 ? (
              <ul className="space-y-2">
                {recipe.ingredients.map((ing) => (
                  <li key={ing.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="w-24 shrink-0 text-sm font-medium text-brand-700 text-right tabular-nums">
                      {[ing.amountOriginal, ing.unitOriginal].filter(Boolean).join(' ')}
                    </span>
                    <span className="text-sm text-gray-800">
                      {ing.name}
                      {ing.optional && <span className="ml-1 text-xs text-gray-400">(optional)</span>}
                      {ing.notes && <span className="ml-1 text-xs text-gray-400">, {ing.notes}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 italic text-sm">Keine Zutaten vorhanden.</p>
            )}
          </div>

          {/* Zubereitung */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Zubereitung</h2>
            {recipe.instructions.length > 0 ? (
              <ol className="space-y-4">
                {recipe.instructions.map((step) => (
                  <li key={step.id} className="flex gap-4">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-500 text-white text-sm font-bold flex items-center justify-center">
                      {step.stepNumber}
                    </span>
                    <p className="text-gray-700 leading-relaxed pt-0.5">{step.content}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-400 italic">Keine Zubereitungsschritte vorhanden.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
