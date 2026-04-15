// src/db/helpers.js
// Thin wrappers around oracledb that abstract connection lifecycle.

'use strict';

import oracledb from 'oracledb';

/**
 * execute()
 * Run any SQL statement; borrows a connection from the pool and releases it.
 *
 * @param {string} sql       - SQL string with bind variables (:name or :1 style)
 * @param {object|Array} binds  - Named or positional bind variables
 * @param {object} opts      - Extra oracledb execute options
 * @returns {Promise<object>} oracledb result object
 */
export async function execute(sql, binds = {}, opts = {}) {
  let conn;
  try {
    conn = await oracledb.getConnection();
    const result = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...opts,
    });
    return result;
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

/**
 * executeProc()
 * Call a PL/SQL stored procedure by name.
 *
 * @param {string} procName   - Fully qualified name, e.g. 'PKG_DISPUTE.SP_CREATE_DISPUTE'
 * @param {object} binds      - Bind object. OUT params must use { dir, type } descriptors.
 * @returns {Promise<object>} The outBinds object from oracledb
 */
export async function executeProc(procName, binds = {}) {
  // Build: BEGIN PKG.PROC(:p1, :p2, ...); END;
  const paramList = Object.keys(binds)
    .map((k) => `:${k}`)
    .join(', ');

  const sql = `BEGIN ${procName}(${paramList}); END;`;

  let conn;
  try {
    conn = await oracledb.getConnection();
    const result = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return result.outBinds || {};
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

/**
 * outBind helpers — shortcuts for common OUT parameter descriptors.
 */
export const OUT = {
  str: (maxSize = 500) => ({
    dir:     oracledb.BIND_OUT,
    type:    oracledb.STRING,
    maxSize,
  }),
  num: () => ({
    dir:  oracledb.BIND_OUT,
    type: oracledb.NUMBER,
  }),
};
