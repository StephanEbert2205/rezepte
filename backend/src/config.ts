import path from 'path';

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendDist: path.resolve(process.env.FRONTEND_DIST ?? '../frontend/dist'),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  fetchTimeout: 12000,
  maxResponseSize: 10 * 1024 * 1024,
  sessionSecret: process.env.SESSION_SECRET ?? 'change-me-in-production',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:5173/api/auth/google/callback',
};
