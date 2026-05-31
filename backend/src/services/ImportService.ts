import { prisma } from '../database';
import { fetchHtml, validatePublicUrl } from './FetchService';
import { ParserRegistry } from '../parsers/ParserRegistry';
import { normalizeIngredients } from './NormalizationService';
import { ParsedRecipe } from '../parsers/types';

const registry = new ParserRegistry();

export async function importRecipeFromUrl(url: string): Promise<number> {
  validatePublicUrl(url);

  // Duplicate detection
  const existing = await prisma.recipe.findUnique({ where: { sourceUrl: url } });
  if (existing) {
    throw new Error(`DUPLICATE:${existing.id}`);
  }

  const html = await fetchHtml(url);
  const parser = registry.getParser(url);
  const parsed = await parser.parse(html, url);

  return await saveRecipe(parsed);
}

async function saveRecipe(parsed: ParsedRecipe): Promise<number> {
  const servings = parsed.servings ?? 4;
  const normalized = normalizeIngredients(parsed.ingredients, servings);

  const recipe = await prisma.recipe.create({
    data: {
      title: parsed.title,
      description: parsed.description,
      sourceUrl: parsed.sourceUrl,
      sourceDomain: parsed.sourceDomain,
      servingsOriginal: parsed.servings,
      servingsBase: servings,
      prepTime: parsed.prepTime,
      cookTime: parsed.cookTime,
      totalTime: parsed.totalTime,
      imageUrl: parsed.imageUrl,
      author: parsed.author,
      ingredients: {
        create: parsed.ingredients.map((ing, idx) => ({
          name: ing.name,
          normalizedName: normalized[idx].normalizedName,
          amountOriginal: ing.amountOriginal,
          unitOriginal: ing.unitOriginal,
          amountPerServing: normalized[idx].amountPerServing !== undefined
            ? normalized[idx].amountPerServing
            : null,
          unitNormalized: normalized[idx].unitNormalized,
          optional: ing.optional,
          notes: ing.notes,
          sortOrder: idx,
        })),
      },
      instructions: {
        create: parsed.instructions.map((inst) => ({
          stepNumber: inst.stepNumber,
          content: inst.content,
        })),
      },
      nutrition: parsed.nutrition
        ? {
            create: {
              calories: parsed.nutrition.calories,
              protein: parsed.nutrition.protein,
              fat: parsed.nutrition.fat,
              carbs: parsed.nutrition.carbs,
              fiber: parsed.nutrition.fiber,
              sugar: parsed.nutrition.sugar,
            },
          }
        : undefined,
    },
  });

  // Upsert tags
  if (parsed.tags.length > 0) {
    for (const tagName of parsed.tags) {
      const tag = await prisma.tag.upsert({
        where: { name: tagName },
        create: { name: tagName },
        update: {},
      });
      await prisma.recipeTag.upsert({
        where: { recipeId_tagId: { recipeId: recipe.id, tagId: tag.id } },
        create: { recipeId: recipe.id, tagId: tag.id },
        update: {},
      });
    }
  }

  return recipe.id;
}
