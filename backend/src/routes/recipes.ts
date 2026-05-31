import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  listRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe,
  getAllTags,
} from '../services/RecipeService';

const router = Router();

// GET /api/recipes
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      search,
      tags,
      vegetarian,
      vegan,
      glutenFree,
      maxTime,
      page,
      limit,
    } = req.query;

    const result = await listRecipes({
      search: typeof search === 'string' ? search : undefined,
      tags: typeof tags === 'string' ? tags.split(',').filter(Boolean) : undefined,
      isVegetarian: vegetarian === 'true',
      isVegan: vegan === 'true',
      isGlutenFree: glutenFree === 'true',
      maxTime: maxTime ? parseInt(String(maxTime)) : undefined,
      page: page ? parseInt(String(page)) : 1,
      limit: limit ? Math.min(parseInt(String(limit)), 100) : 20,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/recipes/tags
router.get('/tags', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await getAllTags();
    res.json(tags);
  } catch (err) {
    next(err);
  }
});

// GET /api/recipes/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Ungültige ID' });
      return;
    }
    const recipe = await getRecipeById(id);
    if (!recipe) {
      res.status(404).json({ error: 'Rezept nicht gefunden' });
      return;
    }
    res.json(recipe);
  } catch (err) {
    next(err);
  }
});

const CustomIngredientSchema = z.object({
  name: z.string().min(1).max(500),
  amount: z.string().max(100),
  unit: z.string().max(50),
  notes: z.string().max(500),
  optional: z.boolean(),
});

const UpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  servingsOriginal: z.number().int().positive().optional(),
  prepTime: z.number().int().nonnegative().optional(),
  cookTime: z.number().int().nonnegative().optional(),
  totalTime: z.number().int().nonnegative().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  isVegetarian: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  isGlutenFree: z.boolean().optional(),
  isLactoseFree: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  customIngredients: z.array(CustomIngredientSchema).nullable().optional(),
});

// PUT /api/recipes/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Ungültige ID' });
      return;
    }

    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const recipe = await updateRecipe(id, parsed.data);
    res.json(recipe);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/recipes/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Ungültige ID' });
      return;
    }
    await deleteRecipe(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
