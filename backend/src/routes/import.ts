import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { importRecipeFromUrl } from '../services/ImportService';

const router = Router();

const ImportSchema = z.object({
  url: z.string().url('Bitte eine gültige URL eingeben'),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = ImportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const recipeId = await importRecipeFromUrl(parsed.data.url);
    res.status(201).json({ id: recipeId, message: 'Rezept erfolgreich importiert' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import fehlgeschlagen';
    if (message.startsWith('DUPLICATE:')) {
      const existingId = parseInt(message.split(':')[1]);
      res.status(409).json({ error: 'Rezept bereits vorhanden', existingId });
      return;
    }
    next(err);
  }
});

export default router;
