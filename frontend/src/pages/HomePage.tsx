import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, X, Clock, Leaf } from 'lucide-react';
import { recipeApi, ListParams } from '../api/client';
import RecipeCard from '../components/RecipeCard';

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ListParams>({});
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const params: ListParams = { ...filters, search: search || undefined, page, limit: 24 };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['recipes', params],
    queryFn: () => recipeApi.list(params),
    placeholderData: (prev) => prev,
  });

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => recipeApi.tags(),
  });

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  }, []);

  const toggleFilter = (key: keyof ListParams, value: boolean) => {
    setFilters((f) => ({ ...f, [key]: f[key] ? undefined : value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setSearch('');
    setPage(1);
  };

  const hasActiveFilters = search || Object.values(filters).some(Boolean);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rezept, Zutat oder Tag suchen..."
            className="input pl-9"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary ${showFilters ? 'bg-brand-50 text-brand-700 border-brand-200' : ''}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filter</span>
        </button>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="btn-secondary text-red-500">
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Filter panel */}
      {showFilters && (
        <div className="card p-4 mb-4 flex flex-wrap gap-3">
          <button
            onClick={() => toggleFilter('vegetarian', true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filters.vegetarian ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-600 border-gray-200 hover:border-green-200'
            }`}
          >
            <Leaf className="w-3.5 h-3.5" /> Vegetarisch
          </button>
          <button
            onClick={() => toggleFilter('vegan', true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filters.vegan ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-600 border-gray-200 hover:border-green-200'
            }`}
          >
            <Leaf className="w-3.5 h-3.5" /> Vegan
          </button>
          <button
            onClick={() => toggleFilter('glutenFree', true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filters.glutenFree ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-white text-gray-600 border-gray-200 hover:border-yellow-200'
            }`}
          >
            Glutenfrei
          </button>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <select
              value={filters.maxTime ?? ''}
              onChange={(e) => {
                const v = e.target.value ? parseInt(e.target.value) : undefined;
                setFilters((f) => ({ ...f, maxTime: v }));
                setPage(1);
              }}
              className="input w-auto text-sm py-1"
            >
              <option value="">Beliebige Zeit</option>
              <option value="15">bis 15 Min.</option>
              <option value="30">bis 30 Min.</option>
              <option value="60">bis 60 Min.</option>
              <option value="90">bis 90 Min.</option>
            </select>
          </div>

          {tags && tags.slice(0, 10).map((tag) => (
            <button
              key={tag.id}
              onClick={() => {
                const current = filters.tags?.split(',') ?? [];
                const has = current.includes(tag.name);
                const next = has ? current.filter((t) => t !== tag.name) : [...current, tag.name];
                setFilters((f) => ({ ...f, tags: next.join(',') || undefined }));
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filters.tags?.includes(tag.name)
                  ? 'bg-brand-50 text-brand-700 border-brand-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-200'
              }`}
            >
              {tag.name}
              <span className="ml-1 text-xs opacity-60">({tag.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Results header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {isLoading ? 'Lade...' : `${data?.total ?? 0} Rezept${data?.total !== 1 ? 'e' : ''}`}
        </p>
      </div>

      {/* Grid */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="aspect-[4/3] bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-16 text-red-500">
          <p>Fehler beim Laden der Rezepte.</p>
          <p className="text-sm mt-1">Ist der Server gestartet?</p>
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          {data.recipes.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg">Keine Rezepte gefunden.</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-2 text-brand-500 hover:underline text-sm">
                  Filter zurücksetzen
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {data.recipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}

          {data.pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary disabled:opacity-40"
              >
                Zurück
              </button>
              <span className="flex items-center px-4 text-sm text-gray-500">
                Seite {page} von {data.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page >= data.pages}
                className="btn-secondary disabled:opacity-40"
              >
                Weiter
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
