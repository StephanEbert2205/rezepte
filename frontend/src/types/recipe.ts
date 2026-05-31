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
