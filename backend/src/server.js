// src/server.js
// Entry point: initialises DB pool, starts HTTP server, wires graceful shutdown.
'use strict';

// Load .env for local dev (ignored in Docker — env vars set via compose)
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(...candidates) {
  for (const envPath of candidates) {
    try {
      const lines = readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (key && !(key in process.env)) process.env[key] = val;
      }
      console.log(`[server] Loaded env from ${envPath}`);
      return;
    } catch (_) { /* try next */ }
  }
}

// Try root .env first, then backend/.env, then backend/src/../.env
loadEnv(
  resolve(__dirname, '../../.env'),         // dispute-orchestrator/.env
  resolve(__dirname, '../.env'),            // backend/.env
  resolve(process.cwd(), '.env'),           // cwd/.env
);

import { config }    from './config.js';
import { initPool, closePool } from './db/pool.js';
import { createApp } from './app.js';

let server;

async function main() {
  // 1. Initialise Oracle connection pool
  await initPool();

  // 2. Create Express app
  const app = createApp();

  // 3. Start HTTP server
  server = app.listen(config.server.port, () => {
    console.log(`[server] Listening on http://0.0.0.0:${config.server.port}`);
    console.log(`[server] NODE_ENV=${config.server.nodeEnv}`);
  });
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[server] Received ${signal}. Shutting down gracefully…`);

  // Stop accepting new connections
  if (server) {
    server.close(async () => {
      console.log('[server] HTTP server closed');
      await closePool();
      process.exit(0);
    });

    // Force exit if server doesn't close within 15 s
    setTimeout(() => {
      console.error('[server] Forced shutdown after timeout');
      process.exit(1);
    }, 15_000).unref();
  } else {
    await closePool();
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
  shutdown('unhandledRejection');
});

main().catch((err) => {
  console.error('[server] Startup error:', err);
  process.exit(1);
});
