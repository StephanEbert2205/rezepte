export interface CustomIngredient {
  name: string;
  amount: string;
  unit: string;
  notes: string;
  optional: boolean;
}

export interface Ingredient {
  id: number;
  recipeId: number;
  name: string;
  normalizedName: string | null;
  amountOriginal: string | null;
  unitOriginal: string | null;
  amountPerServing: number | null;
  unitNormalized: string | null;
  optional: boolean;
  notes: string | null;
  sortOrder: number;
}

export interface Instruction {
  id: number;
  recipeId: number;
  stepNumber: number;
  content: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface RecipeTag {
  recipeId: number;
  tagId: number;
  tag: Tag;
}

export interface Nutrition {
  id: number;
  recipeId: number;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  sugar: number | null;
}

export interface Recipe {
  id: number;
  /** ID des Besitzers; null für Legacy-Rezepte (vor Migration) */
  userId: number | null;
  /** Name des Besitzers (nur relevant wenn Fremd-Rezept) */
  ownerName: string | null;
  /** Darf der aktuelle Nutzer dieses Rezept bearbeiten? */
  canEdit: boolean;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  sourceDomain: string | null;
  servingsOriginal: number | null;
  servingsBase: number;
  prepTime: number | null;
  cookTime: number | null;
  totalTime: number | null;
  imageUrl: string | null;
  difficulty: string | null;
  author: string | null;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isLactoseFree: boolean;
  customIngredients: CustomIngredient[] | null;
  createdAt: string;
  updatedAt: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags: RecipeTag[];
  nutrition: Nutrition | null;
}

export interface RecipeListResponse {
  recipes: Recipe[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface TagWithCount {
  id: number;
  name: string;
  count: number;
}

// ── Sharing ─────────────────────────────────────────────────────────────────

export interface SharedUser {
  id: number;
  name: string;
  email: string;
  picture?: string | null;
}

export interface RecipeShare {
  id: number;
  recipeId: number;
  canEdit: boolean;
  sharedWith: SharedUser;
}

export interface ShareToken {
  token: string;
}

// ── Konto-Verknüpfung ────────────────────────────────────────────────────────

export interface AccountLink {
  id: number;
  status: 'pending' | 'accepted';
  direction: 'outgoing' | 'incoming';
  linkedUser: SharedUser;
  createdAt: string;
}

/** Offene Einladung (E-Mail-Adresse noch ohne Konto). */
export interface Invitation {
  id: number;
  email: string;
  expiresAt: string;
  createdAt: string;
}

/** Antwort von POST /accounts/links – entweder ein Link-Request oder eine Einladung. */
export type RequestLinkResult =
  | ({ type: 'link' } & AccountLink)
  | { type: 'invitation'; id: number; email: string; expiresAt: string; createdAt: string };
