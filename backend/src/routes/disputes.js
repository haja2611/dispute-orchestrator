// src/routes/disputes.js
'use strict';

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { handleValidation, asyncHandler, ALLOWED_DISPUTE_TYPES, ALLOWED_DECISIONS } from '../middleware/validate.js';
import {
  createDispute,
  listDisputes,
  getDisputeById,
  decideDispute,
  refundDispute,
} from '../controllers/disputeController.js';

const router = Router();

// ── POST /disputes ────────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('txnId').notEmpty().isInt({ min: 1 }).withMessage('txnId must be a positive integer'),
    body('custId').notEmpty().isInt({ min: 1 }).withMessage('custId must be a positive integer'),
    body('disputeType')
      .notEmpty()
      .isIn(ALLOWED_DISPUTE_TYPES)
      .withMessage(`disputeType must be one of: ${ALLOWED_DISPUTE_TYPES.join(', ')}`),
    body('claimAmount').notEmpty().isFloat({ min: 0.01 }).withMessage('claimAmount must be > 0'),
    body('actor').notEmpty().trim().withMessage('actor is required'),
  ],
  handleValidation,
  asyncHandler(createDispute)
);

// ── GET /disputes ─────────────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('custId').optional().isInt({ min: 1 }).withMessage('custId must be a positive integer'),
    query('status')
      .optional()
      .isIn(['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REFUND_INITIATED', 'REFUNDED', 'CLOSED'])
      .withMessage('Invalid status filter'),
  ],
  handleValidation,
  asyncHandler(listDisputes)
);

// ── GET /disputes/:id ─────────────────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  handleValidation,
  asyncHandler(getDisputeById)
);

// ── POST /disputes/:id/decision ───────────────────────────────────────────────
router.post(
  '/:id/decision',
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('decision')
      .notEmpty()
      .isIn(ALLOWED_DECISIONS)
      .withMessage(`decision must be one of: ${ALLOWED_DECISIONS.join(', ')}`),
    body('actor').notEmpty().trim().withMessage('actor is required'),
    body('notes').optional().isString(),
  ],
  handleValidation,
  asyncHandler(decideDispute)
);

// ── POST /disputes/:id/refund ─────────────────────────────────────────────────
router.post(
  '/:id/refund',
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('actor').notEmpty().trim().withMessage('actor is required'),
  ],
  handleValidation,
  asyncHandler(refundDispute)
);

export default router;
