import axios from 'axios';
import { Recipe, RecipeListResponse, TagWithCount, RecipeShare, ShareToken, AccountLink } from '../types/recipe';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

/** Vorausgefüllte Daten aus einer Foto-Erkennung (Felder sind optional). */
export interface PrefilledData {
  title?: string;
  description?: string;
  servingsOriginal?: number | null;
  prepTime?: number | null;
  cookTime?: number | null;
  totalTime?: number | null;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isLactoseFree?: boolean;
  tags?: string[];
  ingredients?: CreateIngredient[];
  instructions?: { content: string }[];
}

export interface CreateIngredient {
  name: string;
  amount: string;
  unit: string;
  optional: boolean;
  notes: string;
}

export interface CreateRecipeData {
  title: string;
  description?: string;
  imageUrl?: string;
  servingsOriginal?: number;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isLactoseFree?: boolean;
  tags?: string[];
  ingredients?: CreateIngredient[];
  instructions?: { content: string }[];
}

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

  /** Rezept aus manueller Eingabe anlegen. */
  create: (data: CreateRecipeData) =>
    api.post<{ id: number; message: string }>('/recipes', data).then((r) => r.data),

  /**
   * Rezeptfoto via Claude Vision analysieren.
   * Content-Type wird von axios automatisch auf multipart/form-data gesetzt.
   */
  parseImage: (formData: FormData) =>
    api.post<PrefilledData>('/parse-image', formData, {
      headers: { 'Content-Type': undefined },
    }).then((r) => r.data),

  // ── Freigaben ─────────────────────────────────────────────────────────────

  /** Erzeugt einen Freigabe-Token für das Rezept (Kopie-per-Link). */
  createShareToken: (recipeId: number) =>
    api.post<ShareToken>(`/recipes/${recipeId}/share/token`).then((r) => r.data),

  /** Alle direkten Freigaben eines Rezepts (nur Besitzer). */
  getShares: (recipeId: number) =>
    api.get<RecipeShare[]>(`/recipes/${recipeId}/shares`).then((r) => r.data),

  /** Rezept mit einem anderen Nutzer teilen (per E-Mail). */
  addShare: (recipeId: number, email: string, canEdit: boolean) =>
    api.post<RecipeShare>(`/recipes/${recipeId}/shares`, { email, canEdit }).then((r) => r.data),

  /** Freigabe entfernen. */
  removeShare: (recipeId: number, sharedWithId: number) =>
    api.delete(`/recipes/${recipeId}/shares/${sharedWithId}`),

  /** Rezept-Vorschau per Token abrufen (kein Login nötig). */
  getSharedRecipe: (token: string) =>
    api.get<Recipe>(`/shared/${token}`).then((r) => r.data),

  /** Geteiltes Rezept in die eigene Sammlung kopieren. */
  forkSharedRecipe: (token: string) =>
    api.post<{ id: number; message: string }>(`/shared/${token}/fork`).then((r) => r.data),
};

// ── Konto-Verknüpfungen ────────────────────────────────────────────────────

export const accountApi = {
  /** Alle eigenen Verknüpfungen auflisten. */
  getLinks: () =>
    api.get<AccountLink[]>('/accounts/links').then((r) => r.data),

  /** Verknüpfungsanfrage senden. */
  requestLink: (email: string) =>
    api.post<AccountLink>('/accounts/links', { email }).then((r) => r.data),

  /** Ausstehende Anfrage annehmen. */
  acceptLink: (id: number) =>
    api.post<AccountLink>(`/accounts/links/${id}/accept`).then((r) => r.data),

  /** Verknüpfung oder Anfrage entfernen. */
  removeLink: (id: number) =>
    api.delete(`/accounts/links/${id}`),
};

export default api;
