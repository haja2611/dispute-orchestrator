// src/db/pool.js
// oracledb connection pool singleton.
// Call initPool() once at startup, getPool() everywhere else.

'use strict';

import oracledb from 'oracledb';
import { config } from '../config.js';

// Global defaults
oracledb.autoCommit    = false;
oracledb.outFormat     = oracledb.OUT_FORMAT_OBJECT;

let _pool = null;

/**
 * Initialise the connection pool. Must be awaited before the HTTP server starts.
 */
export async function initPool() {
  if (_pool) return _pool;

  _pool = await oracledb.createPool({
    user:             config.db.user,
    password:         config.db.password,
    connectString:    config.db.connectString,
    poolMin:          config.db.poolMin,
    poolMax:          config.db.poolMax,
    poolIncrement:    config.db.poolIncrement,
    poolTimeout:      config.db.poolTimeout,
    enableStatistics: config.db.enableStatistics,
    poolAlias:        'default',
  });

  console.log(
    `[pool] Connection pool created — min:${config.db.poolMin} ` +
    `max:${config.db.poolMax} connectString:${config.db.connectString}`
  );

  return _pool;
}

/**
 * Return the active pool. Throws if initPool() was not called first.
 */
export function getPool() {
  if (!_pool) throw new Error('[pool] Pool not initialised — call initPool() first');
  return _pool;
}

/**
 * Drain and close the pool. Called on SIGTERM/SIGINT.
 */
export async function closePool() {
  if (!_pool) return;
  try {
    await _pool.close(10); // 10 s drain timeout
    _pool = null;
    console.log('[pool] Connection pool closed');
  } catch (err) {
    console.error('[pool] Error closing pool:', err.message);
  }
}
