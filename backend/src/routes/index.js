// src/routes/index.js
// Mounts all routers onto their path prefixes.
'use strict';

import { Router } from 'express';
import disputesRouter from './disputes.js';
import healthRouter   from './health.js';

const router = Router();

router.use('/disputes', disputesRouter);
router.use('/health',   healthRouter);

// Root ping
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: { message: 'Smart Dispute & Refund Orchestrator API', version: '1.0.0' },
    error: null,
  });
});

export default router;
