import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.statusCode ?? 500;
  const message = err.message ?? 'Interner Serverfehler';

  if (process.env.NODE_ENV === 'development') {
    console.error('[Error]', err);
  }

  res.status(status).json({ error: message });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Nicht gefunden' });
}
