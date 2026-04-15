// src/controllers/healthController.js
'use strict';

import { execute } from '../db/helpers.js';
import { getPool } from '../db/pool.js';

export async function getDbHealth(req, res) {
  const result = await execute(
    `SELECT 'OK' AS STATUS, TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') AS DB_TIME FROM DUAL`
  );

  const row = result.rows[0];

  // Pool statistics
  let poolStats = null;
  try {
    const pool = getPool();
    poolStats = {
      connectionsOpen:  pool.connectionsOpen,
      connectionsInUse: pool.connectionsInUse,
      poolMin:          pool.poolMin,
      poolMax:          pool.poolMax,
    };
  } catch (_) {
    poolStats = { error: 'Pool stats unavailable' };
  }

  return res.status(200).json({
    success: true,
    data: {
      status:   row.STATUS,
      dbTime:   row.DB_TIME,
      poolStats,
    },
    error: null,
  });
}
