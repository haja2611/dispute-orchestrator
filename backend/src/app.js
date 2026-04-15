// src/app.js
// Express app factory — no listen() here (that lives in server.js)
'use strict';

import express   from 'express';
import helmet    from 'helmet';
import morgan    from 'morgan';
import compression from 'compression';
import router    from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet());

  // ── HTTP request logging ──────────────────────────────────────────────────
  app.use(morgan('combined'));

  // ── Gzip compression ──────────────────────────────────────────────────────
  app.use(compression());

  // ── Body parsers ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── CORS (allow frontend dev server) ─────────────────────────────────────
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/', router);

  // ── 404 catch-all ─────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      data:    null,
      error:   `Route not found: ${req.method} ${req.path}`,
    });
  });

  // ── Centralised error handler ─────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
