import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock, Users, ChefHat, ExternalLink, Edit, Trash2, Eye, Leaf, Flame
} from 'lucide-react';
import { recipeApi } from '../api/client';
import PortionSlider from '../components/PortionSlider';
import IngredientList from '../components/IngredientList';
import InstructionList from '../components/InstructionList';
import { formatDuration, formatDate } from '../utils/format';

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const recipeId = parseInt(id ?? '0');

  const [servings, setServings] = useState<number | null>(null);
  const [cookMode, setCookMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const { data: recipe, isLoading, isError } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => recipeApi.get(recipeId),
    enabled: recipeId > 0,
  });

  useEffect(() => {
    if (recipe && Array.isArray(recipe.customIngredients) && recipe.customIngredients.length > 0) {
      setShowCustom(true);
    }
  }, [recipe]);

  const deleteMutation = useMutation({
    mutationFn: () => recipeApi.delete(recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      navigate('/');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-64 bg-gray-200 rounded-xl" />
          <div className="h-8 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-100 rounded w-1/3" />
        </div>
      </div>
    );
  }

  if (isError || !recipe) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-red-500">Rezept nicht gefunden.</p>
        <Link to="/" className="text-brand-500 hover:underline mt-2 inline-block">Zurück zur Übersicht</Link>
      </div>
    );
  }

  const targetServings = servings ?? recipe.servingsOriginal ?? recipe.servingsBase;
  const hasCustom = Array.isArray(recipe.customIngredients) && recipe.customIngredients.length > 0;

  return (
    <div className={`max-w-4xl mx-auto px-4 py-6 ${cookMode ? 'text-lg' : ''}`}>
      {/* Back + actions */}
      <div className="flex items-center justify-between mb-4">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Alle Rezepte
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCookMode(!cookMode)}
            className={`btn-secondary text-sm ${cookMode ? 'bg-brand-50 text-brand-700 border-brand-200' : ''}`}
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">{cookMode ? 'Normal' : 'Kochmodus'}</span>
          </button>
          <Link to={`/rezepte/${recipe.id}/bearbeiten`} className="btn-secondary text-sm">
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">Bearbeiten</span>
          </Link>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="btn-secondary text-sm text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => deleteMutation.mutate()}
                className="btn-danger text-sm"
                disabled={deleteMutation.isPending}
              >
                Löschen
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-sm">
                Abbrechen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hero image */}
      {recipe.imageUrl && (
        <div className="aspect-[16/7] rounded-xl overflow-hidden mb-6 bg-gray-100">
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Title & meta */}
      <h1 className={`font-bold text-gray-900 mb-3 ${cookMode ? 'text-3xl' : 'text-2xl'}`}>
        {recipe.title}
      </h1>

      {/* Badges */}
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

      {/* Time & serving info */}
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
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-brand-600 hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Original-Rezept
          </a>
        )}
      </div>

      {recipe.description && (
        <p className="text-gray-600 mb-6 leading-relaxed">{recipe.description}</p>
      )}

      {/* Main content: ingredients + instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ingredients */}
        <div className={`${cookMode ? 'lg:col-span-1' : 'lg:col-span-1'}`}>
          <div className="sticky top-20">
            {/* Header: title + toggle + portion slider */}
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h2 className={`font-semibold text-gray-900 ${cookMode ? 'text-xl' : 'text-lg'}`}>
                Zutaten
              </h2>
              <div className="flex items-center gap-2 ml-auto">
                {hasCustom && (
                  <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
                    <button
                      onClick={() => setShowCustom(false)}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        !showCustom ? 'bg-white shadow-sm font-medium text-gray-800' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Original
                    </button>
                    <button
                      onClick={() => setShowCustom(true)}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        showCustom ? 'bg-white shadow-sm font-medium text-brand-700' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Angepasst
                    </button>
                  </div>
                )}
                {!showCustom && <PortionSlider servings={targetServings} onChange={setServings} />}
              </div>
            </div>

            {/* Ingredient list */}
            {showCustom && hasCustom ? (
              <ul className="space-y-2">
                {recipe.customIngredients!.map((ing, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-3 py-2 border-b border-gray-50 last:border-0 ${
                      ing.optional ? 'opacity-70' : ''
                    }`}
                  >
                    <span className="w-24 shrink-0 text-sm font-medium text-brand-700 text-right tabular-nums">
                      {[ing.amount, ing.unit].filter(Boolean).join(' ')}
                    </span>
                    <span className="text-sm text-gray-800">
                      {ing.name}
                      {ing.optional && <span className="ml-1 text-xs text-gray-400">(optional)</span>}
                      {ing.notes && <span className="ml-1 text-xs text-gray-400">, {ing.notes}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : recipe.ingredients.length > 0 ? (
              <IngredientList
                ingredients={recipe.ingredients}
                targetServings={targetServings}
                baseServings={recipe.servingsBase}
              />
            ) : (
              <p className="text-gray-400 italic text-sm">Keine Zutaten vorhanden.</p>
            )}

            {/* Nutrition */}
            {recipe.nutrition && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-3">Nährwerte pro Portion</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {recipe.nutrition.calories && (
                    <div>
                      <span className="text-gray-500">Kalorien</span>
                      <span className="font-medium ml-2">{Math.round(Number(recipe.nutrition.calories))} kcal</span>
                    </div>
                  )}
                  {recipe.nutrition.protein && (
                    <div>
                      <span className="text-gray-500">Protein</span>
                      <span className="font-medium ml-2">{Math.round(Number(recipe.nutrition.protein))} g</span>
                    </div>
                  )}
                  {recipe.nutrition.fat && (
                    <div>
                      <span className="text-gray-500">Fett</span>
                      <span className="font-medium ml-2">{Math.round(Number(recipe.nutrition.fat))} g</span>
                    </div>
                  )}
                  {recipe.nutrition.carbs && (
                    <div>
                      <span className="text-gray-500">Kohlenhydrate</span>
                      <span className="font-medium ml-2">{Math.round(Number(recipe.nutrition.carbs))} g</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="lg:col-span-2">
          <h2 className={`font-semibold text-gray-900 mb-4 ${cookMode ? 'text-xl' : 'text-lg'}`}>
            Zubereitung
          </h2>
          <InstructionList instructions={recipe.instructions} cookMode={cookMode} />
        </div>
      </div>

      <p className="mt-10 text-xs text-gray-300 text-right">
        Hinzugefügt am {formatDate(recipe.createdAt)}
      </p>
    </div>
  );
}
