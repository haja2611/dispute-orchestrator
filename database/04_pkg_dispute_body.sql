-- =============================================================================
-- 04_pkg_dispute_body.sql  —  PKG_DISPUTE  package body
-- Oracle 23c Free  |  Run as SYSTEM in FREEPDB1
-- =============================================================================

CREATE OR REPLACE PACKAGE BODY PKG_DISPUTE AS

  -- ══════════════════════════════════════════════════════════════════════════
  --  PRIVATE HELPER
  -- ══════════════════════════════════════════════════════════════════════════

  -- Returns the eligibility window (days) for a given dispute type
  FUNCTION fn_window_days(p_dispute_type IN VARCHAR2) RETURN NUMBER IS
  BEGIN
    RETURN CASE p_dispute_type
      WHEN PKG_DISPUTE_TYPES.C_TYPE_DUPLICATE THEN PKG_DISPUTE_TYPES.C_WIN_DUPLICATE
      WHEN PKG_DISPUTE_TYPES.C_TYPE_SERVICE   THEN PKG_DISPUTE_TYPES.C_WIN_SERVICE
      WHEN PKG_DISPUTE_TYPES.C_TYPE_WRONG     THEN PKG_DISPUTE_TYPES.C_WIN_WRONG
      WHEN PKG_DISPUTE_TYPES.C_TYPE_FRAUD     THEN PKG_DISPUTE_TYPES.C_WIN_FRAUD
      ELSE 30
    END;
  END fn_window_days;

  -- ══════════════════════════════════════════════════════════════════════════
  --  FN_ELIGIBLE
  -- ══════════════════════════════════════════════════════════════════════════
  FUNCTION FN_ELIGIBLE(
    p_txn_id       IN NUMBER,
    p_dispute_type IN VARCHAR2
  ) RETURN VARCHAR2
  IS
    v_txn_status   TRANSACTIONS.status%TYPE;
    v_txn_ts       TRANSACTIONS.txn_ts%TYPE;
    v_window_days  NUMBER;
    v_active_cnt   NUMBER;
  BEGIN

    -- 1. Fetch transaction; raise if not found
    BEGIN
      SELECT status, txn_ts
        INTO v_txn_status, v_txn_ts
        FROM TRANSACTIONS
       WHERE txn_id = p_txn_id;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RETURN 'Transaction not found';
    END;

    -- 2. Already resolved?
    IF v_txn_status IN ('REVERSED', 'CHARGEBACK_DONE') THEN
      RETURN 'Transaction already resolved';
    END IF;

    -- 3. Eligibility window check
    v_window_days := fn_window_days(p_dispute_type);
    IF (SYSDATE - CAST(v_txn_ts AS DATE)) > v_window_days THEN
      RETURN 'Dispute window expired';
    END IF;

    -- 4. Already an open/active dispute for this transaction?
    SELECT COUNT(*)
      INTO v_active_cnt
      FROM DISPUTES
     WHERE txn_id = p_txn_id
       AND status NOT IN (
             PKG_DISPUTE_TYPES.C_STATUS_REJECTED,
             PKG_DISPUTE_TYPES.C_STATUS_REFUNDED
           );

    IF v_active_cnt > 0 THEN
      RETURN 'Active dispute already exists';
    END IF;

    -- All checks passed
    RETURN 'Y';

  EXCEPTION
    WHEN OTHERS THEN
      RETURN '[PKG_DISPUTE.FN_ELIGIBLE] ' || SQLERRM;
  END FN_ELIGIBLE;

  -- ══════════════════════════════════════════════════════════════════════════
  --  FN_RISK_SCORE
  -- ══════════════════════════════════════════════════════════════════════════
  FUNCTION FN_RISK_SCORE(
    p_cust_id IN NUMBER,
    p_txn_id  IN NUMBER
  ) RETURN NUMBER
  IS
    v_score        NUMBER := 0;
    v_kyc_status   CUSTOMERS.kyc_status%TYPE;
    v_txn_amount   TRANSACTIONS.amount%TYPE;
    v_disp_cnt     NUMBER;
  BEGIN

    -- Fetch customer KYC status
    BEGIN
      SELECT kyc_status
        INTO v_kyc_status
        FROM CUSTOMERS
       WHERE customer_id = p_cust_id;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RETURN 100; -- unknown customer = max risk
    END;

    -- +20 if KYC is not FULL
    IF v_kyc_status != 'FULL' THEN
      v_score := v_score + 20;
    END IF;

    -- Fetch transaction amount
    BEGIN
      SELECT amount
        INTO v_txn_amount
        FROM TRANSACTIONS
       WHERE txn_id = p_txn_id;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        v_txn_amount := 0;
    END;

    -- +25 if claim amount > 10000
    IF v_txn_amount > 10000 THEN
      v_score := v_score + 25;
    END IF;

    -- +30 if customer has > 2 disputes in the last 90 days
    SELECT COUNT(*)
      INTO v_disp_cnt
      FROM DISPUTES
     WHERE customer_id = p_cust_id
       AND created_at  >= SYSTIMESTAMP - INTERVAL '90' DAY;

    IF v_disp_cnt > 2 THEN
      v_score := v_score + 30;
    END IF;

    -- Cap at 100
    RETURN LEAST(v_score, 100);

  EXCEPTION
    WHEN OTHERS THEN
      RETURN 100; -- fail-safe: treat as high-risk
  END FN_RISK_SCORE;

  -- ══════════════════════════════════════════════════════════════════════════
  --  SP_AUDIT_EVENT
  --  (defined before SP_CREATE_DISPUTE / SP_DECIDE / SP_REFUND so they can call it)
  -- ══════════════════════════════════════════════════════════════════════════
  PROCEDURE SP_AUDIT_EVENT(
    p_dispute_id IN NUMBER,
    p_event_type IN VARCHAR2,
    p_actor      IN VARCHAR2,
    p_notes      IN VARCHAR2
  ) IS
    PRAGMA AUTONOMOUS_TRANSACTION;
  BEGIN
    INSERT INTO DISPUTE_EVENTS (dispute_id, event_type, actor, notes)
    VALUES (p_dispute_id, p_event_type, p_actor, p_notes);
    COMMIT;
  EXCEPTION
    WHEN OTHERS THEN
      -- Audit must never break the main flow; swallow and re-raise only in debug
      ROLLBACK;
      RAISE;
  END SP_AUDIT_EVENT;

  -- ══════════════════════════════════════════════════════════════════════════
  --  SP_CREATE_DISPUTE
  -- ══════════════════════════════════════════════════════════════════════════
  PROCEDURE SP_CREATE_DISPUTE(
    p_txn_id       IN  NUMBER,
    p_cust_id      IN  NUMBER,
    p_dispute_type IN  VARCHAR2,
    p_claim_amount IN  NUMBER,
    p_actor        IN  VARCHAR2,
    p_dispute_id   OUT NUMBER,
    p_status       OUT VARCHAR2,
    p_message      OUT VARCHAR2
  ) IS
    v_eligible    VARCHAR2(200);
    v_risk_score  NUMBER;
    v_auto_route  VARCHAR2(10);
    v_kyc_status  CUSTOMERS.kyc_status%TYPE;
    v_new_id      NUMBER;
    v_decide_st   VARCHAR2(10);
    v_decide_msg  VARCHAR2(500);
  BEGIN

    -- 1. Eligibility check
    v_eligible := FN_ELIGIBLE(p_txn_id, p_dispute_type);
    IF v_eligible != 'Y' THEN
      p_status  := 'ERROR';
      p_message := v_eligible;
      RETURN;
    END IF;

    -- 2. Risk score
    v_risk_score := FN_RISK_SCORE(p_cust_id, p_txn_id);

    -- Fetch KYC for routing decision
    BEGIN
      SELECT kyc_status
        INTO v_kyc_status
        FROM CUSTOMERS
       WHERE customer_id = p_cust_id;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        p_status  := 'ERROR';
        p_message := '[PKG_DISPUTE.SP_CREATE_DISPUTE] Customer not found';
        RETURN;
    END;

    -- Determine routing
    IF p_claim_amount > PKG_DISPUTE_TYPES.C_AUTO_THRESHOLD THEN
      v_auto_route := PKG_DISPUTE_TYPES.C_ROUTE_MANUAL;
    ELSIF v_risk_score > PKG_DISPUTE_TYPES.C_RISK_THRESHOLD THEN
      v_auto_route := PKG_DISPUTE_TYPES.C_ROUTE_MANUAL;
    ELSIF v_kyc_status != 'FULL' THEN
      v_auto_route := PKG_DISPUTE_TYPES.C_ROUTE_MANUAL;
    ELSE
      v_auto_route := PKG_DISPUTE_TYPES.C_ROUTE_AUTO;
    END IF;

    -- 3. Insert dispute row
    INSERT INTO DISPUTES (
      txn_id, customer_id, dispute_type, claim_amount,
      status, risk_score, routing, actor
    ) VALUES (
      p_txn_id, p_cust_id, p_dispute_type, p_claim_amount,
      PKG_DISPUTE_TYPES.C_STATUS_PENDING, v_risk_score, v_auto_route, p_actor
    )
    RETURNING dispute_id INTO v_new_id;

    p_dispute_id := v_new_id;

    -- 4. Audit: DISPUTE_CREATED
    SP_AUDIT_EVENT(
      v_new_id,
      PKG_DISPUTE_TYPES.C_EVT_CREATED,
      p_actor,
      'Route=' || v_auto_route || ' | RiskScore=' || v_risk_score ||
      ' | Type=' || p_dispute_type || ' | Amount=' || p_claim_amount
    );

    -- 5. Auto-route: immediately approve
    IF v_auto_route = PKG_DISPUTE_TYPES.C_ROUTE_AUTO THEN
      SP_DECIDE(
        p_dispute_id => v_new_id,
        p_decision   => PKG_DISPUTE_TYPES.C_DECISION_APPROVE,
        p_actor      => 'SYSTEM',
        p_notes      => 'Auto-approved: amount <= threshold, risk score <= 70, KYC=FULL',
        p_status     => v_decide_st,
        p_message    => v_decide_msg
      );
      IF v_decide_st != 'OK' THEN
        ROLLBACK;
        p_status  := 'ERROR';
        p_message := '[SP_CREATE_DISPUTE->SP_DECIDE] ' || v_decide_msg;
        RETURN;
      END IF;
      p_message := 'Dispute created and auto-approved. ID=' || v_new_id;
    ELSE
      p_message := 'Dispute created, pending manual review. ID=' || v_new_id;
    END IF;

    p_status := 'OK';
    COMMIT;

  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      p_status  := 'ERROR';
      p_message := '[PKG_DISPUTE.SP_CREATE_DISPUTE] ' || SQLERRM;
  END SP_CREATE_DISPUTE;

  -- ══════════════════════════════════════════════════════════════════════════
  --  SP_DECIDE
  -- ══════════════════════════════════════════════════════════════════════════
  PROCEDURE SP_DECIDE(
    p_dispute_id IN  NUMBER,
    p_decision   IN  VARCHAR2,
    p_actor      IN  VARCHAR2,
    p_notes      IN  VARCHAR2,
    p_status     OUT VARCHAR2,
    p_message    OUT VARCHAR2
  ) IS
    v_current_status  DISPUTES.status%TYPE;
    v_new_status      DISPUTES.status%TYPE;
    v_event_type      DISPUTE_EVENTS.event_type%TYPE;
  BEGIN

    -- 1. Lock the dispute row
    BEGIN
      SELECT status
        INTO v_current_status
        FROM DISPUTES
       WHERE dispute_id = p_dispute_id
         FOR UPDATE NOWAIT;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        p_status  := 'ERROR';
        p_message := '[PKG_DISPUTE.SP_DECIDE] Dispute ID ' || p_dispute_id || ' not found';
        RETURN;
      WHEN OTHERS THEN
        IF SQLCODE = -54 THEN  -- ORA-00054: resource busy
          p_status  := 'ERROR';
          p_message := '[PKG_DISPUTE.SP_DECIDE] Dispute is locked by another session';
        ELSE
          p_status  := 'ERROR';
          p_message := '[PKG_DISPUTE.SP_DECIDE] ' || SQLERRM;
        END IF;
        RETURN;
    END;

    -- 2. Validate status transition
    IF v_current_status IN (
         PKG_DISPUTE_TYPES.C_STATUS_APPROVED,
         PKG_DISPUTE_TYPES.C_STATUS_REFUNDED,
         PKG_DISPUTE_TYPES.C_STATUS_REF_INIT,
         PKG_DISPUTE_TYPES.C_STATUS_CLOSED
       ) THEN
      p_status  := 'ERROR';
      p_message := '[PKG_DISPUTE.SP_DECIDE] Cannot decide on dispute in status: ' || v_current_status;
      RETURN;
    END IF;

    IF v_current_status = PKG_DISPUTE_TYPES.C_STATUS_REJECTED THEN
      p_status  := 'ERROR';
      p_message := '[PKG_DISPUTE.SP_DECIDE] Dispute is already REJECTED';
      RETURN;
    END IF;

    -- 3. Map decision to new status and event type
    CASE UPPER(p_decision)
      WHEN 'APPROVE' THEN
        v_new_status  := PKG_DISPUTE_TYPES.C_STATUS_APPROVED;
        v_event_type  := PKG_DISPUTE_TYPES.C_EVT_APPROVED;
      WHEN 'REJECT' THEN
        v_new_status  := PKG_DISPUTE_TYPES.C_STATUS_REJECTED;
        v_event_type  := PKG_DISPUTE_TYPES.C_EVT_REJECTED;
      WHEN 'MANUAL_REVIEW' THEN
        v_new_status  := PKG_DISPUTE_TYPES.C_STATUS_PENDING;  -- stays PENDING_REVIEW
        v_event_type  := PKG_DISPUTE_TYPES.C_EVT_MANUAL;
      ELSE
        p_status  := 'ERROR';
        p_message := '[PKG_DISPUTE.SP_DECIDE] Invalid decision: ' || p_decision ||
                     '. Must be APPROVE, REJECT, or MANUAL_REVIEW';
        RETURN;
    END CASE;

    -- 4 & 5. Update dispute
    UPDATE DISPUTES
       SET status     = v_new_status,
           actor      = p_actor,
           notes      = p_notes,
           updated_at = SYSTIMESTAMP
     WHERE dispute_id = p_dispute_id;

    -- 6. Audit event
    SP_AUDIT_EVENT(p_dispute_id, v_event_type, p_actor, p_notes);

    -- 7. Commit & return
    COMMIT;
    p_status  := 'OK';
    p_message := 'Dispute ' || p_dispute_id || ' decision applied: ' || v_new_status;

  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      p_status  := 'ERROR';
      p_message := '[PKG_DISPUTE.SP_DECIDE] ' || SQLERRM;
  END SP_DECIDE;

  -- ══════════════════════════════════════════════════════════════════════════
  --  SP_REFUND
  -- ══════════════════════════════════════════════════════════════════════════
  PROCEDURE SP_REFUND(
    p_dispute_id  IN  NUMBER,
    p_actor       IN  VARCHAR2,
    p_refund_id   OUT NUMBER,
    p_reference   OUT VARCHAR2,
    p_status      OUT VARCHAR2,
    p_message     OUT VARCHAR2
  ) IS
    v_dispute_status  DISPUTES.status%TYPE;
    v_claim_amount    DISPUTES.claim_amount%TYPE;
    v_reference_no    VARCHAR2(50);
    v_new_refund_id   NUMBER;
  BEGIN

    -- 1. Validate dispute status
    BEGIN
      SELECT status, claim_amount
        INTO v_dispute_status, v_claim_amount
        FROM DISPUTES
       WHERE dispute_id = p_dispute_id
         FOR UPDATE NOWAIT;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        p_status  := 'ERROR';
        p_message := '[PKG_DISPUTE.SP_REFUND] Dispute ID ' || p_dispute_id || ' not found';
        RETURN;
    END;

    IF v_dispute_status != PKG_DISPUTE_TYPES.C_STATUS_APPROVED THEN
      p_status  := 'ERROR';
      p_message := '[PKG_DISPUTE.SP_REFUND] Dispute must be APPROVED to issue refund. Current status: '
                   || v_dispute_status;
      RETURN;
    END IF;

    -- 2. Generate reference number
    v_reference_no := 'REF-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-' || p_dispute_id;
    p_reference    := v_reference_no;

    -- 3. Insert REFUNDS row (INITIATED)
    INSERT INTO REFUNDS (
      dispute_id, reference_no, refund_amount,
      refund_status, initiated_by, initiated_at
    ) VALUES (
      p_dispute_id, v_reference_no, v_claim_amount,
      'INITIATED', p_actor, SYSTIMESTAMP
    )
    RETURNING refund_id INTO v_new_refund_id;

    p_refund_id := v_new_refund_id;

    -- 4. Move dispute to REFUND_INITIATED
    UPDATE DISPUTES
       SET status     = PKG_DISPUTE_TYPES.C_STATUS_REF_INIT,
           updated_at = SYSTIMESTAMP
     WHERE dispute_id = p_dispute_id;

    -- 5. Audit: REFUND_INITIATED
    SP_AUDIT_EVENT(
      p_dispute_id,
      PKG_DISPUTE_TYPES.C_EVT_REF_INIT,
      p_actor,
      'RefundID=' || v_new_refund_id || ' | RefNo=' || v_reference_no
    );

    -- 6. Simulate refund completion
    UPDATE REFUNDS
       SET refund_status = 'COMPLETED',
           completed_at  = SYSTIMESTAMP,
           updated_at    = SYSTIMESTAMP
     WHERE refund_id = v_new_refund_id;

    -- 7. Mark dispute REFUNDED
    UPDATE DISPUTES
       SET status     = PKG_DISPUTE_TYPES.C_STATUS_REFUNDED,
           updated_at = SYSTIMESTAMP
     WHERE dispute_id = p_dispute_id;

    SP_AUDIT_EVENT(
      p_dispute_id,
      PKG_DISPUTE_TYPES.C_EVT_REFUNDED,
      p_actor,
      'Refund completed. RefNo=' || v_reference_no
    );

    COMMIT;
    p_status  := 'OK';
    p_message := 'Refund completed. RefNo=' || v_reference_no;

  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      p_status  := 'ERROR';
      p_message := '[PKG_DISPUTE.SP_REFUND] ' || SQLERRM;
  END SP_REFUND;

END PKG_DISPUTE;
/

SHOW ERRORS PACKAGE BODY PKG_DISPUTE;
