// src/controllers/disputeController.js
'use strict';

import oracledb from 'oracledb';
import { execute, executeProc, OUT } from '../db/helpers.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function plsqlError(message) {
  const err = new Error(message);
  err.type = 'plsql_error';
  return err;
}

function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

// ─── POST /disputes ──────────────────────────────────────────────────────────

export async function createDispute(req, res, next) {
  try {
    const { txnId, custId, disputeType, claimAmount, actor } = req.body;

    const out = await executeProc('PKG_DISPUTE.SP_CREATE_DISPUTE', {
      p_txn_id:       Number(txnId),
      p_cust_id:      Number(custId),
      p_dispute_type: disputeType,
      p_claim_amount: Number(claimAmount),
      p_actor:        actor,
      p_dispute_id:   OUT.num(),
      p_status:       OUT.str(10),
      p_message:      OUT.str(1000),
    });

    if (out.p_status !== 'OK') {
      return next(plsqlError(out.p_message));
    }

    return res.status(201).json({
      success: true,
      data: {
        disputeId: out.p_dispute_id,
        status:    out.p_status,
        message:   out.p_message,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /disputes ───────────────────────────────────────────────────────────

export async function listDisputes(req, res, next) {
  try {
    const { custId, status } = req.query;

    let sql = `
      SELECT
        d.dispute_id,
        d.txn_id,
        d.customer_id,
        c.full_name          AS customer_name,
        t.merchant_name,
        t.amount             AS txn_amount,
        t.txn_ts,
        d.dispute_type,
        d.claim_amount,
        d.status             AS dispute_status,
        d.risk_score,
        d.routing,
        d.actor,
        d.created_at,
        d.updated_at
      FROM DISPUTES      d
      JOIN TRANSACTIONS  t ON t.txn_id      = d.txn_id
      JOIN CUSTOMERS     c ON c.customer_id = d.customer_id
      WHERE 1=1
    `;

    const binds = {};

    if (custId) {
      sql += ' AND d.customer_id = :custId';
      binds.custId = Number(custId);
    }

    if (status) {
      sql += ' AND d.status = :status';
      binds.status = status.toUpperCase();
    }

    sql += ' ORDER BY d.created_at DESC';

    const result = await execute(sql, binds);

    return res.status(200).json({
      success: true,
      data:    result.rows,
      error:   null,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /disputes/:id ───────────────────────────────────────────────────────

export async function getDisputeById(req, res, next) {
  try {
    const disputeId = Number(req.params.id);

    // Main dispute row
    const disputeResult = await execute(
      `SELECT
         d.dispute_id,
         d.txn_id,
         d.customer_id,
         c.full_name          AS customer_name,
         c.kyc_status,
         c.email,
         t.merchant_name,
         t.amount             AS txn_amount,
         t.txn_ts,
         t.status             AS txn_status,
         t.txn_reference,
         d.dispute_type,
         d.claim_amount,
         d.status             AS dispute_status,
         d.risk_score,
         d.routing,
         d.actor,
         d.notes,
         d.created_at,
         d.updated_at
       FROM DISPUTES      d
       JOIN TRANSACTIONS  t ON t.txn_id      = d.txn_id
       JOIN CUSTOMERS     c ON c.customer_id = d.customer_id
       WHERE d.dispute_id = :id`,
      { id: disputeId }
    );

    if (!disputeResult.rows || disputeResult.rows.length === 0) {
      return next(notFound(`Dispute ${disputeId} not found`));
    }

    // Audit events
    const eventsResult = await execute(
      `SELECT event_id, event_type, actor, notes, created_at
         FROM DISPUTE_EVENTS
        WHERE dispute_id = :id
        ORDER BY created_at ASC`,
      { id: disputeId }
    );

    return res.status(200).json({
      success: true,
      data: {
        dispute: disputeResult.rows[0],
        events:  eventsResult.rows,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /disputes/:id/decision ─────────────────────────────────────────────

export async function decideDispute(req, res, next) {
  try {
    const disputeId            = Number(req.params.id);
    const { decision, actor, notes } = req.body;

    const out = await executeProc('PKG_DISPUTE.SP_DECIDE', {
      p_dispute_id: disputeId,
      p_decision:   decision,
      p_actor:      actor,
      p_notes:      notes || null,
      p_status:     OUT.str(10),
      p_message:    OUT.str(1000),
    });

    if (out.p_status !== 'OK') {
      return next(plsqlError(out.p_message));
    }

    return res.status(200).json({
      success: true,
      data: {
        disputeId,
        status:  out.p_status,
        message: out.p_message,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /disputes/:id/refund ────────────────────────────────────────────────

export async function refundDispute(req, res, next) {
  try {
    const disputeId  = Number(req.params.id);
    const { actor }  = req.body;

    const out = await executeProc('PKG_DISPUTE.SP_REFUND', {
      p_dispute_id: disputeId,
      p_actor:      actor,
      p_refund_id:  OUT.num(),
      p_reference:  OUT.str(100),
      p_status:     OUT.str(10),
      p_message:    OUT.str(1000),
    });

    if (out.p_status !== 'OK') {
      return next(plsqlError(out.p_message));
    }

    return res.status(200).json({
      success: true,
      data: {
        disputeId,
        refundId:    out.p_refund_id,
        referenceNo: out.p_reference,
        status:      out.p_status,
        message:     out.p_message,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}
