import { RecipeParser } from './types';
import { GenericParser } from './generic/GenericParser';
import { ChefkochParser } from './chefkoch/ChefkochParser';
import { GuteKuecheParser } from './gutekueche/GuteKuecheParser';

export class ParserRegistry {
  private parsers: RecipeParser[] = [
    new ChefkochParser(),
    new GuteKuecheParser(),
    new GenericParser(), // Always last — handles everything
  ];

  getParser(url: string): RecipeParser {
    return this.parsers.find((p) => p.canHandle(url)) ?? new GenericParser();
  }
}
