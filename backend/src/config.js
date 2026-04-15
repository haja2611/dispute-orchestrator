// src/config.js
// Reads process.env and exports a typed config object.
// Throws on startup if required secrets are missing.

'use strict';

if (!process.env.DB_PASSWORD) {
  throw new Error(
    '[config] DB_PASSWORD environment variable is required but not set. ' +
    'Copy .env.example to .env and set a value.'
  );
}

export const config = Object.freeze({
  db: {
    user:          process.env.DB_USER          || 'system',
    password:      process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING || 'localhost:1521/FREEPDB1',
    poolMin:       2,
    poolMax:       10,
    poolIncrement: 2,
    poolTimeout:   60,
    enableStatistics: false,
  },
  server: {
    port:    parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
});
