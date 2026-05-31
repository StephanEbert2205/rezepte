import * as cheerio from 'cheerio';
import { ParsedRecipe, ParsedIngredient, ParsedInstruction, RecipeParser } from '../types';
import { parseIngredient } from '../IngredientParser';
import { GenericParser } from '../generic/GenericParser';

export class GuteKuecheParser implements RecipeParser {
  private generic = new GenericParser();

  canHandle(url: string): boolean {
    return url.includes('gutekueche.de') || url.includes('gutekueche.at') || url.includes('gutekueche.ch');
  }

  async parse(html: string, url: string): Promise<ParsedRecipe> {
    const result = await this.generic.parse(html, url);
    if (result.ingredients.length > 0 && result.instructions.length > 0) {
      return result;
    }

    const $ = cheerio.load(html);

    const title = $('h1.recipe-title, h1').first().text().trim() || result.title;
    const imageUrl = $('meta[property="og:image"]').attr('content') || result.imageUrl;

    const ingredients: ParsedIngredient[] = [];
    $('[class*="ingredient"] li, .zutaten li').each((_, el) => {
      const text = $(el).text().trim();
      if (text) ingredients.push(parseIngredient(text));
    });

    const instructions: ParsedInstruction[] = [];
    $('[class*="step"] p, .zubereitung ol li, .preparation li').each((idx, el) => {
      const text = $(el).text().trim();
      if (text) instructions.push({ stepNumber: idx + 1, content: text });
    });

    return {
      ...result,
      title,
      imageUrl: imageUrl || result.imageUrl,
      ingredients: ingredients.length > 0 ? ingredients : result.ingredients,
      instructions: instructions.length > 0 ? instructions : result.instructions,
      sourceDomain: 'gutekueche.de',
    };
  }
}
