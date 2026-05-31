export interface ParsedIngredient {
  raw: string;
  name: string;
  amountOriginal?: string;
  unitOriginal?: string;
  amountNumeric?: number;
  optional: boolean;
  notes?: string;
}

export interface ParsedInstruction {
  stepNumber: number;
  content: string;
}

export interface ParsedNutrition {
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
}

export interface ParsedRecipe {
  title: string;
  description?: string;
  sourceUrl: string;
  sourceDomain: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  imageUrl?: string;
  author?: string;
  ingredients: ParsedIngredient[];
  instructions: ParsedInstruction[];
  tags: string[];
  nutrition?: ParsedNutrition;
}

export interface RecipeParser {
  canHandle(url: string): boolean;
  parse(html: string, url: string): Promise<ParsedRecipe>;
}
