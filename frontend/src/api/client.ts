import axios from 'axios';
import { Recipe, RecipeListResponse, TagWithCount, RecipeShare, ShareToken, AccountLink, Invitation, RequestLinkResult } from '../types/recipe';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

/** Vorausgefüllte Daten aus einer Foto-Erkennung (Felder sind optional). */
export interface PrefilledData {
  title?: string;
  description?: string;
  imageUrl?: string;
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

  /** Bild hochladen (ohne OCR) – gibt die öffentliche URL zurück. */
  uploadImage: (formData: FormData) =>
    api.post<{ url: string }>('/upload-image', formData, {
      headers: { 'Content-Type': undefined },
    }).then((r) => r.data.url),

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

  /** Verknüpfungsanfrage senden oder – bei unbekannter E-Mail – Einladung verschicken. */
  requestLink: (email: string) =>
    api.post<RequestLinkResult>('/accounts/links', { email }).then((r) => r.data),

  /** Ausstehende Anfrage annehmen. */
  acceptLink: (id: number) =>
    api.post<AccountLink>(`/accounts/links/${id}/accept`).then((r) => r.data),

  /** Verknüpfung oder Anfrage entfernen. */
  removeLink: (id: number) =>
    api.delete(`/accounts/links/${id}`),

  /** Gesendete Einladungen (noch nicht registrierte E-Mails) auflisten. */
  getInvitations: () =>
    api.get<Invitation[]>('/accounts/invitations').then((r) => r.data),

  /** Einladung zurückziehen. */
  cancelInvitation: (id: number) =>
    api.delete(`/accounts/invitations/${id}`),
};

// ── Einladungs-API (öffentlich + auth) ──────────────────────────────────────

export interface InvitationInfo {
  inviterName: string;
  inviterPicture: string | null;
  email: string;
  expiresAt: string;
}

export const invitationApi = {
  /** Öffentliche Einladungs-Infos (für die Landingpage, kein Login nötig). */
  get: (token: string) =>
    api.get<InvitationInfo>(`/invitations/${token}`).then((r) => r.data),

  /** Einladung annehmen (eingeloggter Nutzer). Erstellt und aktiviert den Link sofort. */
  accept: (token: string) =>
    api.post<AccountLink>(`/invitations/${token}/accept`).then((r) => r.data),
};

// ── Report-API ─────────────────────────────────────────────────────────────

export const REPORT_CATEGORIES = [
  { id: 'import_error',        label: 'Rezept wird nicht importiert'  },
  { id: 'wrong_ingredients',   label: 'Falsche Zutaten / Mengen'      },
  { id: 'wrong_steps',         label: 'Fehlende / falsche Schritte'   },
  { id: 'wrong_image_or_diet', label: 'Falsches Bild oder Diät-Flag'  },
  { id: 'other',               label: 'Sonstiges'                     },
] as const;

export type ReportCategoryId = (typeof REPORT_CATEGORIES)[number]['id'];

export const reportApi = {
  /** Problem an einem Rezept melden. */
  create: (recipeId: number, categories: ReportCategoryId[], comment: string) =>
    api.post<{ id: number; message: string }>(
      `/recipes/${recipeId}/report`,
      { categories, comment }
    ).then((r) => r.data),
};

// ── Admin-API ──────────────────────────────────────────────────────────────

export interface AdminStats {
  users: number;
  recipes: number;
  ingredients: number;
  activeLinks: number;
  pendingLinks: number;
  invitations: number;
  openReports: number;
  topSources: { domain: string; count: number }[];
}

export interface AdminReport {
  id: number;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
  categories: string[];
  categoryLabels: string[];
  comment: string | null;
  recipe: { id: number; title: string; source: string | null };
  reporter: { id: number; name: string; email: string };
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  picture: string | null;
  isAdmin: boolean;
  createdAt: string;
  recipeCount: number;
  lastRecipeAt: string | null;
}

export interface AdminRecipe {
  id: number;
  title: string;
  sourceDomain: string | null;
  imageUrl: string | null;
  createdAt: string;
  servings: number | null;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  ingredientCount: number;
  owner: { id: number | null; name: string; email: string };
}

export interface AdminRecipeList {
  recipes: AdminRecipe[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AdminLink {
  id: number;
  status: 'pending' | 'accepted';
  createdAt: string;
  requester: { id: number; name: string; email: string };
  accepter:  { id: number; name: string; email: string };
}

export interface AdminInvitation {
  id: number;
  email: string;
  expiresAt: string;
  createdAt: string;
  inviterName: string;
  inviterEmail: string;
}

export const adminApi = {
  getStats: () =>
    api.get<AdminStats>('/admin/stats').then((r) => r.data),

  getUsers: () =>
    api.get<AdminUser[]>('/admin/users').then((r) => r.data),

  toggleAdmin: (userId: number) =>
    api.post<{ id: number; isAdmin: boolean }>(`/admin/users/${userId}/toggle-admin`).then((r) => r.data),

  getRecipes: (params: { search?: string; userId?: number; page?: number; limit?: number } = {}) =>
    api.get<AdminRecipeList>('/admin/recipes', { params }).then((r) => r.data),

  getLinks: () =>
    api.get<{ links: AdminLink[]; invitations: AdminInvitation[] }>('/admin/links').then((r) => r.data),

  getReports: (status: 'open' | 'resolved' | 'all' = 'open') =>
    api.get<AdminReport[]>('/admin/reports', { params: { status } }).then((r) => r.data),

  resolveReport: (id: number) =>
    api.post(`/admin/reports/${id}/resolve`).then((r) => r.data),
};

// ── Changelog-API ─────────────────────────────────────────────────────────────

export interface ChangelogEntry {
  id:             number;
  version:        string | null;
  releaseDate:    string;           // YYYY-MM-DD
  title:          string;
  body:           string;
  isPublished:    boolean | number;
  isAiGenerated:  boolean | number;
  gitHash:        string | null;
  createdAt:      string;
  updatedAt:      string;
}

/** Commit aus dem .pending-commits.json-Upload (noch nicht in DB) */
export interface PendingCommit {
  hash:    string;
  short:   string;
  message: string;
  date:    string;
  author:  string;
}

/** Commit in der changelog_commits-Tabelle (nach Import) */
export interface ChangelogCommit {
  id:          number;
  hash:        string;
  shortHash:   string;
  message:     string;
  commitDate:  string;
  author:      string;
  deployTag:   string;
  importedAt:  string;
  isTechnical: boolean | number;
  status:      'pending' | 'included' | 'skipped';
  entryId:     number | null;
  decidedAt:   string | null;
}

export interface ImportResult {
  imported:        number;
  skippedExisting: number;
  deployTag:       string;
  /** Neu erzeugter KI-Entwurf, falls im JSON vorhanden. */
  aiEntry:         ChangelogEntry | null;
}

export const changelogApi = {
  /** Veröffentlichte Einträge (öffentlich, kein Login nötig). */
  list: () =>
    api.get<ChangelogEntry[]>('/changelog').then((r) => r.data),

  /** Changelog als gelesen markieren (speichert NOW() beim Nutzer in der DB). */
  markRead: () =>
    api.post<{ ok: boolean }>('/changelog/read').then((r) => r.data),

  // ── Admin ──────────────────────────────────────────────────────────────
  listAll: () =>
    api.get<ChangelogEntry[]>('/admin/changelog').then((r) => r.data),

  create: (data: Omit<ChangelogEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<ChangelogEntry>('/admin/changelog', data).then((r) => r.data),

  update: (id: number, data: Omit<ChangelogEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<ChangelogEntry>(`/admin/changelog/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/admin/changelog/${id}`),

  publish: (id: number) =>
    api.post<ChangelogEntry>(`/admin/changelog/${id}/publish`).then((r) => r.data),

  unpublish: (id: number) =>
    api.post<ChangelogEntry>(`/admin/changelog/${id}/unpublish`).then((r) => r.data),

  // ── Commit-Review ──────────────────────────────────────────────────────
  /** Importiert neue Commits aus api/.pending-commits.json in die DB. */
  importCommits: () =>
    api.post<ImportResult>('/admin/changelog/import-commits').then((r) => r.data),

  /** Alle importierten Commits (optional nach Status filtern). */
  listCommits: (status?: 'pending' | 'included' | 'skipped') =>
    api.get<ChangelogCommit[]>('/admin/changelog/commits', { params: status ? { status } : {} })
      .then((r) => r.data),

  /** Einzelnen Commit als „aufgenommen" markieren. */
  includeCommit: (id: number) =>
    api.post<ChangelogCommit>(`/admin/changelog/commits/${id}/include`).then((r) => r.data),

  /** Einzelnen Commit als „übersprungen" markieren. */
  skipCommit: (id: number) =>
    api.post<ChangelogCommit>(`/admin/changelog/commits/${id}/skip`).then((r) => r.data),

  /** Massen-Entscheidung für ausstehende Commits. */
  bulkDecide: (filter: 'non-technical' | 'technical' | 'all', decision: 'included' | 'skipped') =>
    api.post<{ affected: number }>('/admin/changelog/bulk-decide', { filter, decision })
      .then((r) => r.data),

  /** Erstellt einen Changelog-Entwurf aus allen aufgenommenen Commits ohne Eintrag. */
  buildDraft: () =>
    api.post<ChangelogEntry>('/admin/changelog/build-draft').then((r) => r.data),

  /** Anzahl ausstehender Commits (für Badge). */
  pendingCount: () =>
    api.get<{ count: number }>('/admin/changelog/pending-count').then((r) => r.data),

  // ── KI-Entwürfe ────────────────────────────────────────────────────────
  /** Alle vom KI generierten, noch nicht freigegebenen Entwürfe. */
  listAiPending: () =>
    api.get<ChangelogEntry[]>('/admin/changelog/ai-pending').then((r) => r.data),

  /** KI-Entwurf aufnehmen → wird sofort veröffentlicht. */
  approveAiDraft: (id: number) =>
    api.post<ChangelogEntry>(`/admin/changelog/${id}/approve`).then((r) => r.data),

  /** KI-Entwurf überspringen → wird gelöscht. */
  skipAiDraft: (id: number) =>
    api.delete(`/admin/changelog/${id}/ai`),
};

export default api;
