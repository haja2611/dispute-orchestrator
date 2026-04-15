// src/middleware/errorHandler.js
// Centralised Express error handler — must be last app.use() in app.js

'use strict';

/**
 * Maps Oracle error codes to HTTP status codes.
 */
const ORA_HTTP_MAP = {
  '00001': 409, // unique constraint violated
  '01422': 422, // exact fetch returns more than requested rows
  '01403': 404, // no data found
  '04061': 400, // existing state of package has been discarded
};

function parseOracleCode(message) {
  if (!message) return null;
  const match = message.match(/ORA-(\d{5})/);
  return match ? match[1] : null;
}

/**
 * Standard response shape:
 * { success: boolean, data: any, error: string|null }
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // express-validator validation errors
  if (err.type === 'validation') {
    return res.status(400).json({
      success: false,
      data:    null,
      error:   err.message || 'Validation failed',
      details: err.details || [],
    });
  }

  // PL/SQL returned p_status='ERROR'
  if (err.type === 'plsql_error') {
    return res.status(422).json({
      success: false,
      data:    null,
      error:   err.message,
    });
  }

  // Oracle DB errors
  const oraCode = parseOracleCode(err.message);
  if (oraCode) {
    const status = ORA_HTTP_MAP[oraCode] || 500;
    return res.status(status).json({
      success: false,
      data:    null,
      error:   `Oracle error ORA-${oraCode}: ${err.message}`,
    });
  }

  // 404 — explicit not-found errors thrown in controllers
  if (err.status === 404) {
    return res.status(404).json({
      success: false,
      data:    null,
      error:   err.message || 'Resource not found',
    });
  }

  // Generic 500
  const isDev = process.env.NODE_ENV !== 'production';
  console.error('[errorHandler]', err);
  return res.status(500).json({
    success: false,
    data:    null,
    error:   isDev ? err.message : 'Internal server error',
  });
}
