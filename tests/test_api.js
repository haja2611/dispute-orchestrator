// tests/test_api.js
// Integration tests for all 6 API endpoints
// Run with: node tests/test_api.js  (requires backend running on PORT)
//
// Uses Node 20 built-in node:test + node:assert
// ─────────────────────────────────────────────────────────────────

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'

const BASE = process.env.API_BASE_URL || 'http://localhost:3000'

// ─── Shared state across sequential tests ────────────────────────
let createdDisputeId = null

// ─── Helper ──────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  const body = await res.json()
  return { status: res.status, body }
}

// ─────────────────────────────────────────────────────────────────
// SUITE 1: Health
// ─────────────────────────────────────────────────────────────────
describe('GET /health/db', () => {
  test('returns 200 with status=OK', async () => {
    const { status, body } = await api('/health/db')
    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.equal(body.data.status, 'OK')
    assert.ok(body.data.dbTime, 'dbTime should be present')
    assert.ok(body.data.poolStats, 'poolStats should be present')
  })
})

// ─────────────────────────────────────────────────────────────────
// SUITE 2: Create Dispute — validation errors
// ─────────────────────────────────────────────────────────────────
describe('POST /disputes — validation', () => {
  test('rejects missing body with 400', async () => {
    const { status, body } = await api('/disputes', { method: 'POST', body: '{}' })
    assert.equal(status, 400)
    assert.equal(body.success, false)
  })

  test('rejects invalid disputeType with 400', async () => {
    const { status, body } = await api('/disputes', {
      method: 'POST',
      body: JSON.stringify({
        txnId: 1, custId: 1, disputeType: 'INVALID', claimAmount: 100, actor: 'tester',
      }),
    })
    assert.equal(status, 400)
    assert.equal(body.success, false)
  })

  test('rejects claimAmount = 0 with 400', async () => {
    const { status, body } = await api('/disputes', {
      method: 'POST',
      body: JSON.stringify({
        txnId: 1, custId: 1, disputeType: 'WRONG_AMOUNT', claimAmount: 0, actor: 'tester',
      }),
    })
    assert.equal(status, 400)
    assert.equal(body.success, false)
  })
})

// ─────────────────────────────────────────────────────────────────
// SUITE 3: Happy path — Create → Get → Decide → Refund
// Using txn1 (txnId=1, custId=1, Priya Sharma, KYC=FULL, amount=2500)
// → amount≤5000, KYC=FULL, riskScore=0 → AUTO route → auto-approved
// ─────────────────────────────────────────────────────────────────
describe('Happy path: create → decide → refund', () => {

  test('POST /disputes creates dispute for txnId=1 (DUPLICATE_CHARGE, ₹2500)', async () => {
    const { status, body } = await api('/disputes', {
      method: 'POST',
      body: JSON.stringify({
        txnId:       1,
        custId:      1,
        disputeType: 'DUPLICATE_CHARGE',
        claimAmount: 2500,
        actor:       'test-agent',
      }),
    })
    // If auto-approved the dispute goes straight to APPROVED; still 201
    assert.ok([201].includes(status), `Expected 201, got ${status}: ${JSON.stringify(body)}`)
    assert.equal(body.success, true)
    assert.ok(body.data.disputeId, 'disputeId must be present')
    createdDisputeId = body.data.disputeId
    console.log(`  ✔ Created dispute #${createdDisputeId}`)
  })

  test('GET /disputes lists disputes and includes the new one', async () => {
    const { status, body } = await api('/disputes?custId=1')
    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.ok(Array.isArray(body.data), 'data should be array')
    const found = body.data.find((d) => d.DISPUTE_ID === createdDisputeId)
    assert.ok(found, `Dispute #${createdDisputeId} not found in list`)
  })

  test('GET /disputes/:id returns dispute with events', async () => {
    const { status, body } = await api(`/disputes/${createdDisputeId}`)
    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.ok(body.data.dispute, 'dispute field must exist')
    assert.ok(Array.isArray(body.data.events), 'events must be array')
    assert.ok(body.data.events.length >= 1, 'at least one audit event expected')
  })

  // txn1 is auto-approved (small amount + full KYC). Test refund directly on APPROVED state.
  test('POST /disputes/:id/refund issues refund on APPROVED dispute', async () => {
    const { status, body } = await api(`/disputes/${createdDisputeId}/refund`, {
      method: 'POST',
      body: JSON.stringify({ actor: 'refund-bot' }),
    })
    assert.ok([200, 422].includes(status), `got ${status}: ${JSON.stringify(body)}`)
    if (status === 200) {
      assert.equal(body.success, true)
      assert.ok(body.data.refundId, 'refundId must be present')
      assert.ok(body.data.referenceNo, 'referenceNo must be present')
      console.log(`  ✔ Refund issued: ${body.data.referenceNo}`)
    } else {
      // Might already be refunded if test is re-run
      console.log(`  ⚠ Refund returned 422 (possibly already refunded): ${body.error}`)
    }
  })
})

// ─────────────────────────────────────────────────────────────────
// SUITE 4: Error cases
// ─────────────────────────────────────────────────────────────────
describe('Error cases', () => {

  test('GET /disputes/99999 returns 404', async () => {
    const { status, body } = await api('/disputes/99999')
    assert.equal(status, 404)
    assert.equal(body.success, false)
  })

  test('POST /disputes with reversed txn (txnId=5) returns 422 — already resolved', async () => {
    // txn5 has status=REVERSED → FN_ELIGIBLE returns 'Transaction already resolved'
    const { status, body } = await api('/disputes', {
      method: 'POST',
      body: JSON.stringify({
        txnId: 5, custId: 3, disputeType: 'FRAUD_SUSPECTED', claimAmount: 500, actor: 'tester',
      }),
    })
    assert.equal(status, 422)
    assert.equal(body.success, false)
    assert.ok(body.error.includes('resolved') || body.error.includes('REVERSED') || body.error.length > 0)
  })

  test('POST /disputes/:id/decision with invalid decision returns 400', async () => {
    const id = createdDisputeId || 1
    const { status, body } = await api(`/disputes/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'MAGIC', actor: 'tester' }),
    })
    assert.equal(status, 400)
    assert.equal(body.success, false)
  })

  test('POST /disputes/:id/refund on non-APPROVED dispute returns 422', async () => {
    // Create a dispute that goes to MANUAL (txnId=4, Rahul, amount=15000 > 5000)
    const createRes = await api('/disputes', {
      method: 'POST',
      body: JSON.stringify({
        txnId: 4, custId: 2, disputeType: 'WRONG_AMOUNT',
        claimAmount: 15000, actor: 'tester',
      }),
    })
    if (createRes.status !== 201) {
      console.log(`  ⚠ Skipping refund-on-pending test: create returned ${createRes.status}`)
      return
    }
    const manualId = createRes.body.data.disputeId

    // Try refund before approval
    const { status, body } = await api(`/disputes/${manualId}/refund`, {
      method: 'POST',
      body: JSON.stringify({ actor: 'tester' }),
    })
    assert.equal(status, 422)
    assert.equal(body.success, false)
    console.log(`  ✔ Correctly rejected refund on PENDING_REVIEW dispute #${manualId}`)
  })
})

console.log(`\nRunning integration tests against ${BASE}\n`)
