import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import path from 'path';
import fs from 'fs';

import './passport';
import passport from 'passport';
import { prisma } from './database';
import importRouter from './routes/import';
import recipesRouter from './routes/recipes';
import authRouter from './routes/auth';
import { errorHandler, notFound } from './middleware/errorHandler';
import { requireAuth } from './middleware/requireAuth';
import { config } from './config';

const app = express();

app.set('trust proxy', 1);

// Apache reverse proxy does not forward X-Forwarded-Proto by default.
// Without it, express-session refuses to set Secure cookies even though
// the client connection is HTTPS.  We force the header in production.
if (config.nodeEnv === 'production') {
  app.use((req, _res, next) => {
    if (!req.headers['x-forwarded-proto']) {
      req.headers['x-forwarded-proto'] = 'https';
    }
    next();
  });
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);

app.use(
  cors({
    origin:
      config.nodeEnv === 'development'
        ? ['http://localhost:5173', 'http://localhost:3001']
        : false,
    credentials: true,
  }),
);

app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
    }),
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Tage
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

const importLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Zu viele Import-Anfragen, bitte warten.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Zu viele Anfragen, bitte warten.' },
});

app.use('/api', apiLimiter);
app.use('/api/auth', authRouter);
app.use('/api', requireAuth);
app.use('/api/import', importLimiter, importRouter);
app.use('/api/recipes', recipesRouter);

const frontendPath = config.frontendDist;
if (config.nodeEnv === 'production' && fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
