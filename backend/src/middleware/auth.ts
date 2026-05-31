import { Request, Response, NextFunction } from 'express';

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.IMPORT_API_KEY;
  if (!apiKey) { next(); return; }

  // Allow requests from the app's own frontend.
  // FRONTEND_ORIGIN may be a comma-separated list, e.g. "https://rezepte.familie-ebert.net"
  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);

  if (allowedOrigins.length > 0) {
    const origin  = (req.headers['origin']  as string) ?? '';
    const referer = (req.headers['referer'] as string) ?? '';
    const sameOrigin =
      (origin  && allowedOrigins.includes(origin)) ||
      (referer && allowedOrigins.some(o => referer.startsWith(o + '/')));
    if (sameOrigin) { next(); return; }
  }

  if (req.headers['x-api-key'] !== apiKey) {
    res.status(401).json({ error: 'Ungültiger API-Key' });
    return;
  }
  next();
}
