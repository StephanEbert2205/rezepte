import * as cheerio from 'cheerio';
import { ParsedRecipe, ParsedIngredient, ParsedInstruction, RecipeParser } from '../types';
import { parseIngredient } from '../IngredientParser';
import { parseIso8601Duration, parseHumanDuration } from '../TimeParser';

export class GenericParser implements RecipeParser {
  canHandle(_url: string): boolean {
    return true; // Fallback for all sites
  }

  async parse(html: string, url: string): Promise<ParsedRecipe> {
    const $ = cheerio.load(html);
    const sourceDomain = new URL(url).hostname.replace('www.', '');

    // Try JSON-LD first
    const jsonLdResult = this.parseJsonLd($, url, sourceDomain);
    if (jsonLdResult && jsonLdResult.ingredients.length > 0) {
      return jsonLdResult;
    }

    // Fallback to heuristic HTML extraction
    return this.parseHeuristic($, url, sourceDomain);
  }

  private parseJsonLd(
    $: cheerio.CheerioAPI,
    url: string,
    sourceDomain: string,
  ): ParsedRecipe | null {
    const scripts = $('script[type="application/ld+json"]');
    let recipeData: Record<string, unknown> | null = null;

    scripts.each((_, el) => {
      try {
        const content = $(el).html() ?? '';
        const parsed = JSON.parse(content);
        const candidate = this.findRecipeInGraph(parsed);
        if (candidate) recipeData = candidate;
      } catch {
        // Ignore malformed JSON-LD
      }
    });

    if (!recipeData) return null;
    return this.extractFromSchemaOrg(recipeData, url, sourceDomain);
  }

  private findRecipeInGraph(data: unknown): Record<string, unknown> | null {
    if (!data || typeof data !== 'object') return null;
    const obj = data as Record<string, unknown>;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = this.findRecipeInGraph(item);
        if (found) return found;
      }
      return null;
    }

    const type = obj['@type'];
    if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
      return obj;
    }

    // Search in @graph
    const graph = obj['@graph'];
    if (Array.isArray(graph)) {
      for (const item of graph) {
        const found = this.findRecipeInGraph(item);
        if (found) return found;
      }
    }

    return null;
  }

  private extractFromSchemaOrg(
    data: Record<string, unknown>,
    url: string,
    sourceDomain: string,
  ): ParsedRecipe {
    const str = (val: unknown): string | undefined => {
      if (typeof val === 'string') return val.trim() || undefined;
      return undefined;
    };

    const title = str(data['name']) ?? 'Unbekanntes Rezept';
    const description = str(data['description']);
    const author = this.extractAuthor(data['author']);
    const imageUrl = this.extractImage(data['image']);

    const prepTime = this.parseTime(data['prepTime']);
    const cookTime = this.parseTime(data['cookTime']);
    const totalTime = this.parseTime(data['totalTime']) ?? (prepTime && cookTime ? prepTime + cookTime : undefined);

    const servings = this.extractServings(data['recipeYield']);

    const ingredientRaws = this.toStringArray(data['recipeIngredient']);
    const ingredients: ParsedIngredient[] = ingredientRaws
      .filter((s) => s.trim().length > 0)
      .map((raw) => parseIngredient(raw));

    const instructionRaws = this.extractInstructions(data['recipeInstructions']);
    const instructions: ParsedInstruction[] = instructionRaws.map((content, idx) => ({
      stepNumber: idx + 1,
      content,
    }));

    const tags = [
      ...this.toStringArray(data['keywords']).flatMap((k) => k.split(',').map((s) => s.trim())),
      ...this.toStringArray(data['recipeCategory']),
      ...this.toStringArray(data['recipeCuisine']),
    ].filter(Boolean);

    const nutrition = this.extractNutrition(data['nutrition']);

    return {
      title,
      description,
      sourceUrl: url,
      sourceDomain,
      servings,
      prepTime,
      cookTime,
      totalTime,
      imageUrl,
      author,
      ingredients,
      instructions,
      tags: [...new Set(tags)],
      nutrition,
    };
  }

  private parseTime(val: unknown): number | undefined {
    if (!val) return undefined;
    if (typeof val === 'string') {
      if (val.startsWith('P')) return parseIso8601Duration(val);
      return parseHumanDuration(val);
    }
    return undefined;
  }

  private extractAuthor(val: unknown): string | undefined {
    if (!val) return undefined;
    if (typeof val === 'string') return val.trim() || undefined;
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      return typeof obj['name'] === 'string' ? obj['name'].trim() || undefined : undefined;
    }
    return undefined;
  }

  private extractImage(val: unknown): string | undefined {
    if (!val) return undefined;
    if (typeof val === 'string') return val.trim() || undefined;
    if (Array.isArray(val)) return this.extractImage(val[0]);
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      return this.extractImage(obj['url']);
    }
    return undefined;
  }

  private extractServings(val: unknown): number | undefined {
    if (!val) return undefined;
    if (typeof val === 'number') return val;
    const str = Array.isArray(val) ? String(val[0]) : String(val);
    const match = str.match(/\d+/);
    return match ? parseInt(match[0]) : undefined;
  }

  private toStringArray(val: unknown): string[] {
    if (!val) return [];
    if (typeof val === 'string') return [val];
    if (Array.isArray(val)) return val.filter((v) => typeof v === 'string');
    return [];
  }

  private extractInstructions(val: unknown): string[] {
    if (!val) return [];
    if (typeof val === 'string') return [val].filter(Boolean);
    if (Array.isArray(val)) {
      return val.flatMap((item) => {
        if (typeof item === 'string') return [item];
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          if (obj['@type'] === 'HowToSection' && Array.isArray(obj['itemListElement'])) {
            return this.extractInstructions(obj['itemListElement']);
          }
          const text = obj['text'] ?? obj['name'];
          if (typeof text === 'string') return [text];
        }
        return [];
      }).filter(Boolean);
    }
    return [];
  }

  private extractNutrition(val: unknown): ParsedRecipe['nutrition'] {
    if (!val || typeof val !== 'object') return undefined;
    const obj = val as Record<string, unknown>;

    const parseNutVal = (v: unknown): number | undefined => {
      if (!v) return undefined;
      const m = String(v).match(/[\d.,]+/);
      if (!m) return undefined;
      const n = parseFloat(m[0].replace(',', '.'));
      return isNaN(n) ? undefined : n;
    };

    return {
      calories: parseNutVal(obj['calories']),
      protein: parseNutVal(obj['proteinContent']),
      fat: parseNutVal(obj['fatContent']),
      carbs: parseNutVal(obj['carbohydrateContent']),
      fiber: parseNutVal(obj['fiberContent']),
      sugar: parseNutVal(obj['sugarContent']),
    };
  }

  private parseHeuristic(
    $: cheerio.CheerioAPI,
    url: string,
    sourceDomain: string,
  ): ParsedRecipe {
    const title =
      $('h1').first().text().trim() ||
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('title').text().trim() ||
      'Unbekanntes Rezept';

    const imageUrl =
      $('meta[property="og:image"]').attr('content') ??
      $('img[itemprop="image"]').attr('src');

    const description = $('meta[property="og:description"]').attr('content')?.trim();

    return {
      title,
      description,
      sourceUrl: url,
      sourceDomain,
      imageUrl,
      ingredients: [],
      instructions: [],
      tags: [],
    };
  }
}
