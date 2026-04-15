# Smart Dispute & Refund Orchestrator

> A production-grade fintech dispute management system built on **Oracle 19c PL/SQL**, **Node.js 20 + Express 5**, and **React 18 + Vite + TailwindCSS** — fully containerised with Docker Compose.

---

## Prerequisites

| Tool            | Minimum Version | Notes                              |
|-----------------|-----------------|------------------------------------|
| Docker Desktop  | 24.0            | WSL 2 backend recommended on Windows |
| Node.js         | 20.0            | For running tests locally          |
| RAM             | 4 GB free       | Oracle container needs ~2.5 GB     |

---

## Quick Start (3 commands)

```bash
git clone <repo-url> dispute-orchestrator
cd dispute-orchestrator
cp .env.example .env          # edit DB_PASSWORD if desired
bash setup.sh                 # waits for Oracle, starts all services
```

Services will be available at:

| Service  | URL                        |
|----------|----------------------------|
| REST API | http://localhost:3000      |
| React UI | http://localhost:5173      |
| API Docs | `backend/openapi.yaml`     |

---

## Architecture

```
┌──────────────┐     HTTP/JSON      ┌─────────────────────────────┐
│  React 18    │ ──────────────────▶│  Express 5 (Node 20)        │
│  Vite + TW   │                    │  ● helmet / morgan / gzip   │
│  TanStack Q  │                    │  ● express-validator        │
└──────────────┘                    │  ● oracledb pool (min2/max10│
      │ nginx proxy                 └────────────┬────────────────┘
      └──────── /disputes, /health ──────────────┘
                                                 │ CALL PKG_DISPUTE.*
                                    ┌────────────▼────────────────┐
                                    │  Oracle 23c Free (Docker)   │
                                    │  ● PKG_DISPUTE_TYPES        │
                                    │  ● PKG_DISPUTE (spec+body)  │
                                    │  ● DISPUTE_EVENTS (audit)   │
                                    └─────────────────────────────┘
```

**Design principle:** All business rules live in Oracle PL/SQL. Node.js is a pure orchestration facade that maps HTTP ↔ PL/SQL procedure calls.

---

## How Business Rules Work

### Eligibility (`FN_ELIGIBLE`)
Before any dispute is created, four checks run in Oracle:

1. **Transaction exists** — ORA-NO_DATA_FOUND → "Transaction not found"
2. **Not already resolved** — `status IN ('REVERSED','CHARGEBACK_DONE')` → rejected
3. **Dispute window** — per-type time limits:
   - `DUPLICATE_CHARGE` → 30 days
   - `SERVICE_NOT_DELIVERED` → 15 days
   - `WRONG_AMOUNT` → 7 days
   - `FRAUD_SUSPECTED` → 60 days
4. **No open dispute** — prevents duplicate active disputes on same transaction

### Risk Scoring (`FN_RISK_SCORE`) — 0 to 100
| Signal | Points |
|--------|--------|
| KYC ≠ FULL | +20 |
| Amount > ₹10,000 | +25 |
| > 2 disputes in last 90 days | +30 |
| (capped at 100) | |

### Routing Decision (`SP_CREATE_DISPUTE`)
```
IF claim_amount > 5000        → MANUAL
ELSIF risk_score > 70         → MANUAL
ELSIF kyc_status != 'FULL'    → MANUAL
ELSE                          → AUTO  → immediately APPROVED
```

### Refund Flow (`SP_REFUND`)
```
APPROVED → REFUND_INITIATED → REFUNDED  (simulated in a single call)
```
Each step produces an immutable row in `DISPUTE_EVENTS`.

---

## API Reference

All responses follow: `{ success: boolean, data: any, error: string|null }`

### `GET /health/db`
```bash
curl http://localhost:3000/health/db
```

### `POST /disputes`
```bash
curl -X POST http://localhost:3000/disputes \
  -H 'Content-Type: application/json' \
  -d '{"txnId":1,"custId":1,"disputeType":"DUPLICATE_CHARGE","claimAmount":2500,"actor":"agent-1"}'
```

### `GET /disputes`
```bash
curl "http://localhost:3000/disputes?custId=1&status=APPROVED"
```

### `GET /disputes/:id`
```bash
curl http://localhost:3000/disputes/1
```

### `POST /disputes/:id/decision`
```bash
curl -X POST http://localhost:3000/disputes/1/decision \
  -H 'Content-Type: application/json' \
  -d '{"decision":"APPROVE","actor":"senior-agent","notes":"Verified"}'
# decision: APPROVE | REJECT | MANUAL_REVIEW
```

### `POST /disputes/:id/refund`
```bash
curl -X POST http://localhost:3000/disputes/1/refund \
  -H 'Content-Type: application/json' \
  -d '{"actor":"refund-bot"}'
```

---

## Seed Data Reference

After startup, these transactions are pre-loaded for testing:

| txn_id | Customer       | KYC     | Merchant  | Amount (₹) | Status    | Age    |
|--------|----------------|---------|-----------|------------|-----------|--------|
| 1      | Priya Sharma   | FULL    | Swiggy    | 2,500      | SETTLED   | 5d     |
| 2      | Priya Sharma   | FULL    | Amazon    | 8,000      | SETTLED   | 10d    |
| 3      | Rahul Mehta    | PARTIAL | Zomato    | 1,200      | SETTLED   | 3d     |
| 4      | Rahul Mehta    | PARTIAL | Flipkart  | 15,000     | SETTLED   | 20d    |
| 5      | Aisha Khan     | NONE    | PayTM     | 500        | **REVERSED** | 1d  |

**Routing prediction:**
- txnId=1 (₹2,500 + KYC=FULL) → **AUTO → APPROVED immediately**
- txnId=2 (₹8,000 > ₹5,000)  → **MANUAL** (even with FULL KYC)
- txnId=3 (KYC=PARTIAL)       → **MANUAL**
- txnId=4 (₹15,000)           → **MANUAL**
- txnId=5 (REVERSED)          → **INELIGIBLE** — FN_ELIGIBLE returns error

---

## Running Tests

```bash
# API integration tests (backend must be running)
cd dispute-orchestrator
node tests/test_api.js

# DB sanity check (run inside Oracle container)
docker exec -i dispute_oracle sqlplus system/${DB_PASSWORD}@FREEPDB1 @/container-entrypoint-initdb.d/tests/test_db.sql
```

---

## Troubleshooting

### Oracle takes > 3 minutes to start
Normal on first boot — it's initialising the CDB/PDB on fresh volume. The `setup.sh` polls up to 3 minutes. Increase `MAX_WAIT` if on slower hardware.

### `ORA-12514: TNS:listener does not currently know of service`
The listener started before the PDB registered. Wait 30s and retry. The backend will also retry on pool init errors.

### `DB_CONNECT_STRING` in Docker vs local dev
- **Docker (backend service):** `oracle:1521/FREEPDB1` (container network hostname)
- **Local dev:** `localhost:1521/FREEPDB1`

### Package body fails to compile
Run `SHOW ERRORS PACKAGE BODY PKG_DISPUTE;` in sqlplus. Ensure `02_pkg_types.sql` and `03_pkg_dispute_spec.sql` ran successfully first.

### Port conflicts
Edit `.env` to change `PORT=3000` or expose different host ports in `docker-compose.yml`.

---

## Extension Ideas

- **SLA breach alerting** — add `sla_deadline` column to DISPUTES; cron job fires `SP_AUDIT_EVENT` with `SLA_BREACHED` when deadline passes
- **Rate limiting** — add `express-rate-limit` middleware per `custId`
- **Risk ML integration** — replace `FN_RISK_SCORE` body with an HTTP call to a Python scoring microservice
- **Webhook notifications** — trigger on `DISPUTE_EVENTS` INSERT via an Oracle trigger + DBMS_AQ
- **Multi-currency** — extend REFUNDS with exchange-rate lookup before refund completion
- **Admin dashboard** — aggregate metrics view: approval rates, avg processing time, dispute type distribution
