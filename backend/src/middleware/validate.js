// src/middleware/validate.js
// Input validation helpers using express-validator.

'use strict';

import { validationResult } from 'express-validator';

export const ALLOWED_DISPUTE_TYPES = [
  'DUPLICATE_CHARGE',
  'SERVICE_NOT_DELIVERED',
  'WRONG_AMOUNT',
  'FRAUD_SUSPECTED',
];

export const ALLOWED_DECISIONS = ['APPROVE', 'REJECT', 'MANUAL_REVIEW'];

/**
 * asyncHandler — wraps async route handlers so thrown errors propagate to next(err).
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * handleValidation — call after express-validator chains.
 * Collects errors and passes a typed validation error to next().
 */
export function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed');
    err.type    = 'validation';
    err.details = errors.array();
    return next(err);
  }
  next();
}
