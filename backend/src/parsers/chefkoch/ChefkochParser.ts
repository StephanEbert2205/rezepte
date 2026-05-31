import * as cheerio from 'cheerio';
import { ParsedRecipe, ParsedIngredient, ParsedInstruction, RecipeParser } from '../types';
import { parseIngredient } from '../IngredientParser';
import { GenericParser } from '../generic/GenericParser';

export class ChefkochParser implements RecipeParser {
  private generic = new GenericParser();

  canHandle(url: string): boolean {
    return url.includes('chefkoch.de');
  }

  async parse(html: string, url: string): Promise<ParsedRecipe> {
    // JSON-LD works well on Chefkoch — use generic parser first
    const result = await this.generic.parse(html, url);
    if (result.ingredients.length > 0 && result.instructions.length > 0) {
      return result;
    }

    // Fallback: DOM-based extraction
    const $ = cheerio.load(html);
    const sourceDomain = 'chefkoch.de';

    const title = $('h1.recipe-title, h1[class*="title"]').first().text().trim() || result.title;
    const description = $('[class*="recipe-description"], [class*="summary"]').first().text().trim() || result.description;
    const imageUrl = $('img[class*="recipe-image"], picture source').first().attr('srcset')?.split(',').pop()?.trim().split(' ')[0] || result.imageUrl;

    // Ingredients table: Chefkoch has amount | unit | ingredient
    const ingredients: ParsedIngredient[] = [];
    $('table.ingredients tr, [class*="ingredient-"]').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const amount = cells.eq(0).text().trim();
        const name = cells.eq(1).text().trim();
        if (name) {
          ingredients.push(parseIngredient(amount ? `${amount} ${name}` : name));
        }
      }
    });

    // Instructions
    const instructions: ParsedInstruction[] = [];
    $('[class*="step"], [class*="instruction"], .preparation-steps ol li').each((idx, el) => {
      const text = $(el).text().trim();
      if (text) {
        instructions.push({ stepNumber: idx + 1, content: text });
      }
    });

    return {
      ...result,
      title,
      description: description || result.description,
      imageUrl: imageUrl || result.imageUrl,
      ingredients: ingredients.length > 0 ? ingredients : result.ingredients,
      instructions: instructions.length > 0 ? instructions : result.instructions,
      sourceDomain,
    };
  }
}
