import { Link } from 'react-router-dom';
import { Clock, Users, Leaf } from 'lucide-react';
import { Recipe } from '../types/recipe';
import { formatDuration } from '../utils/format';

interface Props {
  recipe: Recipe;
}

export default function RecipeCard({ recipe }: Props) {
  return (
    <Link to={`/rezepte/${recipe.id}`} className="card group hover:shadow-md transition-shadow">
      <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3C6.48 3 2 7.48 2 12s4.48 9 10 9 10-4.48 10-10S17.52 3 12 3zm-1 14H9V7h2v10zm4 0h-2V7h2v10z" />
            </svg>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-brand-600 transition-colors">
          {recipe.title}
        </h3>

        {recipe.description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{recipe.description}</p>
        )}

        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
          {recipe.totalTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(recipe.totalTime)}
            </span>
          )}
          {recipe.servingsOriginal && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {recipe.servingsOriginal} Port.
            </span>
          )}
          {(recipe.isVegetarian || recipe.isVegan) && (
            <span className="flex items-center gap-1 text-green-600">
              <Leaf className="w-3.5 h-3.5" />
              {recipe.isVegan ? 'Vegan' : 'Vegetarisch'}
            </span>
          )}
        </div>

        {recipe.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {recipe.tags.slice(0, 3).map(({ tag }) => (
              <span key={tag.id} className="tag-chip">{tag.name}</span>
            ))}
            {recipe.tags.length > 3 && (
              <span className="tag-chip">+{recipe.tags.length - 3}</span>
            )}
          </div>
        )}

        {recipe.sourceDomain && (
          <p className="mt-2 text-xs text-gray-400">von {recipe.sourceDomain}</p>
        )}
      </div>
    </Link>
  );
}
