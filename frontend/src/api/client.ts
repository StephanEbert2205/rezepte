import axios from 'axios';
import { Recipe, RecipeListResponse, TagWithCount } from '../types/recipe';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export interface ListParams {
  search?: string;
  tags?: string;
  vegetarian?: boolean;
  vegan?: boolean;
  glutenFree?: boolean;
  maxTime?: number;
  page?: number;
  limit?: number;
}

export const recipeApi = {
  list: (params: ListParams = {}) =>
    api.get<RecipeListResponse>('/recipes', { params }).then((r) => r.data),

  get: (id: number) =>
    api.get<Recipe>(`/recipes/${id}`).then((r) => r.data),

  update: (id: number, data: Omit<Partial<Recipe>, 'tags'> & { tags?: string[] }) =>
    api.put<Recipe>(`/recipes/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/recipes/${id}`),

  tags: () =>
    api.get<TagWithCount[]>('/recipes/tags').then((r) => r.data),

  import: (url: string) =>
    api.post<{ id: number; message: string }>('/import', { url }).then((r) => r.data),
};

export default api;
