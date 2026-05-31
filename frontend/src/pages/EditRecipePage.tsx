import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, X, Plus } from 'lucide-react';
import { recipeApi } from '../api/client';
import CustomIngredientEditor from '../components/CustomIngredientEditor';
import { CustomIngredient } from '../types/recipe';

export default function EditRecipePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const recipeId = parseInt(id ?? '0');

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => recipeApi.get(recipeId),
    enabled: recipeId > 0,
  });

  const [form, setForm] = useState({
    title: '',
    description: '',
    prepTime: '',
    cookTime: '',
    totalTime: '',
    servingsOriginal: '',
    imageUrl: '',
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
    isLactoseFree: false,
    tags: [] as string[],
  });
  const [newTag, setNewTag] = useState('');
  const [customIngredients, setCustomIngredients] = useState<CustomIngredient[]>([]);

  useEffect(() => {
    if (recipe) {
      setForm({
        title: recipe.title,
        description: recipe.description ?? '',
        prepTime: recipe.prepTime?.toString() ?? '',
        cookTime: recipe.cookTime?.toString() ?? '',
        totalTime: recipe.totalTime?.toString() ?? '',
        servingsOriginal: recipe.servingsOriginal?.toString() ?? '',
        imageUrl: recipe.imageUrl ?? '',
        isVegetarian: recipe.isVegetarian,
        isVegan: recipe.isVegan,
        isGlutenFree: recipe.isGlutenFree,
        isLactoseFree: recipe.isLactoseFree,
        tags: recipe.tags.map((rt) => rt.tag.name),
      });
      setCustomIngredients(recipe.customIngredients ?? []);
    }
  }, [recipe]);

  const mutation = useMutation({
    mutationFn: () =>
      recipeApi.update(recipeId, {
        title: form.title,
        description: form.description,
        prepTime: form.prepTime ? parseInt(form.prepTime) : undefined,
        cookTime: form.cookTime ? parseInt(form.cookTime) : undefined,
        totalTime: form.totalTime ? parseInt(form.totalTime) : undefined,
        servingsOriginal: form.servingsOriginal ? parseInt(form.servingsOriginal) : undefined,
        imageUrl: form.imageUrl,
        isVegetarian: form.isVegetarian,
        isVegan: form.isVegan,
        isGlutenFree: form.isGlutenFree,
        isLactoseFree: form.isLactoseFree,
        tags: form.tags,
        customIngredients: (() => {
          const valid = customIngredients.filter(i => i.name.trim() !== '');
          return valid.length > 0 ? valid : null;
        })(),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      navigate(`/rezepte/${updated.id}`);
    },
  });

  const addTag = () => {
    const t = newTag.trim();
    if (t && !form.tags.includes(t)) {
      setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    }
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 animate-pulse">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center text-red-500">
        Rezept nicht gefunden.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Rezept bearbeiten</h1>
        <Link to={`/rezepte/${recipeId}`} className="btn-secondary text-sm">
          Abbrechen
        </Link>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="space-y-5"
      >
        <div className="card p-5 space-y-4">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Grunddaten</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="input resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bild-URL</label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              className="input"
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Zeiten & Portionen</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Portionen</label>
              <input
                type="number"
                value={form.servingsOriginal}
                onChange={(e) => setForm((f) => ({ ...f, servingsOriginal: e.target.value }))}
                className="input"
                min="1"
                placeholder="4"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gesamtzeit (Min.)</label>
              <input
                type="number"
                value={form.totalTime}
                onChange={(e) => setForm((f) => ({ ...f, totalTime: e.target.value }))}
                className="input"
                min="0"
                placeholder="60"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vorbereitung (Min.)</label>
              <input
                type="number"
                value={form.prepTime}
                onChange={(e) => setForm((f) => ({ ...f, prepTime: e.target.value }))}
                className="input"
                min="0"
                placeholder="20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kochzeit (Min.)</label>
              <input
                type="number"
                value={form.cookTime}
                onChange={(e) => setForm((f) => ({ ...f, cookTime: e.target.value }))}
                className="input"
                min="0"
                placeholder="40"
              />
            </div>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Kategorien</h2>

          <div className="flex flex-wrap gap-2">
            {[
              { key: 'isVegetarian', label: 'Vegetarisch' },
              { key: 'isVegan', label: 'Vegan' },
              { key: 'isGlutenFree', label: 'Glutenfrei' },
              { key: 'isLactoseFree', label: 'Laktosefrei' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key as keyof typeof form] as boolean}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                  className="rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 tag-chip pr-1">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Tag hinzufügen..."
                className="input text-sm"
              />
              <button type="button" onClick={addTag} className="btn-secondary">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div>
            <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Eigene Zutaten</h2>
            <p className="text-xs text-gray-400 mt-1">
              Eigene Anpassungen zur Zutatenliste — z.&nbsp;B. andere Mengen, zusätzliche Zutaten oder
              Vereinfachungen. Das Original bleibt erhalten und kann jederzeit wieder angezeigt werden.
            </p>
          </div>
          <CustomIngredientEditor
            ingredients={customIngredients}
            onChange={setCustomIngredients}
            originalIngredients={recipe.ingredients}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Link to={`/rezepte/${recipeId}`} className="btn-secondary">Abbrechen</Link>
          <button
            type="submit"
            disabled={mutation.isPending || !form.title.trim()}
            className="btn-primary"
          >
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Speichert...</>
            ) : (
              <><Save className="w-4 h-4" /> Speichern</>
            )}
          </button>
        </div>

        {mutation.isError && (
          <p className="text-red-500 text-sm text-center">Fehler beim Speichern.</p>
        )}
      </form>
    </div>
  );
}
