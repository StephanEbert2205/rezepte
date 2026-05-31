import { prisma } from '../database';
import { Prisma } from '@prisma/client';

export const recipeInclude = {
  ingredients: { orderBy: { sortOrder: 'asc' as const } },
  instructions: { orderBy: { stepNumber: 'asc' as const } },
  tags: { include: { tag: true } },
  nutrition: true,
};

export type RecipeWithRelations = Prisma.RecipeGetPayload<{
  include: typeof recipeInclude;
}>;

export interface RecipeListParams {
  search?: string;
  tags?: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  maxTime?: number;
  page?: number;
  limit?: number;
}

export async function listRecipes(params: RecipeListParams) {
  const { search, tags, isVegetarian, isVegan, isGlutenFree, maxTime, page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.RecipeWhereInput = {};

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { title: { contains: term } },
      { description: { contains: term } },
      { ingredients: { some: { name: { contains: term } } } },
      { tags: { some: { tag: { name: { contains: term } } } } },
    ];
  }

  if (isVegetarian) where.isVegetarian = true;
  if (isVegan) where.isVegan = true;
  if (isGlutenFree) where.isGlutenFree = true;
  if (maxTime) where.totalTime = { lte: maxTime };

  if (tags && tags.length > 0) {
    where.tags = {
      some: { tag: { name: { in: tags } } },
    };
  }

  const [recipes, total] = await Promise.all([
    prisma.recipe.findMany({
      where,
      include: recipeInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.recipe.count({ where }),
  ]);

  return { recipes, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getRecipeById(id: number): Promise<RecipeWithRelations | null> {
  return prisma.recipe.findUnique({ where: { id }, include: recipeInclude });
}

export interface CustomIngredient {
  name: string;
  amount: string;
  unit: string;
  notes: string;
  optional: boolean;
}

export async function updateRecipe(
  id: number,
  data: Partial<{
    title: string;
    description: string;
    servingsOriginal: number;
    prepTime: number;
    cookTime: number;
    totalTime: number;
    imageUrl: string;
    isVegetarian: boolean;
    isVegan: boolean;
    isGlutenFree: boolean;
    isLactoseFree: boolean;
    tags: string[];
    customIngredients: CustomIngredient[] | null;
  }>,
): Promise<RecipeWithRelations> {
  const { tags, customIngredients, ...recipeData } = data;

  const updateData: Record<string, unknown> = { ...recipeData };
  if (customIngredients !== undefined) {
    // empty array → clear (set NULL); otherwise store as JSON
    updateData.customIngredients =
      customIngredients === null || customIngredients.length === 0
        ? Prisma.DbNull
        : customIngredients;
  }

  const recipe = await prisma.recipe.update({
    where: { id },
    data: updateData,
    include: recipeInclude,
  });

  if (tags !== undefined) {
    await prisma.recipeTag.deleteMany({ where: { recipeId: id } });
    for (const tagName of tags) {
      const tag = await prisma.tag.upsert({
        where: { name: tagName },
        create: { name: tagName },
        update: {},
      });
      await prisma.recipeTag.create({ data: { recipeId: id, tagId: tag.id } });
    }
  }

  return getRecipeById(id) as Promise<RecipeWithRelations>;
}

export async function deleteRecipe(id: number): Promise<void> {
  await prisma.recipe.delete({ where: { id } });
}

export async function getAllTags(): Promise<{ id: number; name: string; count: number }[]> {
  const tags = await prisma.tag.findMany({
    include: { _count: { select: { recipes: true } } },
    orderBy: { recipes: { _count: 'desc' } },
  });
  return tags.map((t) => ({ id: t.id, name: t.name, count: t._count.recipes }));
}
