// src/routes/health.js
'use strict';

import { Router } from 'express';
import { asyncHandler } from '../middleware/validate.js';
import { getDbHealth } from '../controllers/healthController.js';

const router = Router();

// GET /health/db
router.get('/db', asyncHandler(getDbHealth));

export default router;
