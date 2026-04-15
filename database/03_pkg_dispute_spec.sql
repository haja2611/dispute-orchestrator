-- =============================================================================
-- 03_pkg_dispute_spec.sql  —  PKG_DISPUTE  package specification
-- =============================================================================

CREATE OR REPLACE PACKAGE PKG_DISPUTE AS

  -- ══════════════════════════════════════════════════════════════════════════
  --  FUNCTIONS
  -- ══════════════════════════════════════════════════════════════════════════

  /**
   * FN_ELIGIBLE
   * Checks whether a transaction is eligible for the given dispute type.
   * Returns 'Y' on success or a descriptive error message string.
   */
  FUNCTION FN_ELIGIBLE(
    p_txn_id       IN NUMBER,
    p_dispute_type IN VARCHAR2
  ) RETURN VARCHAR2;

  /**
   * FN_RISK_SCORE
   * Computes a 0-100 risk score for the customer/transaction pair.
   * Score > 70 forces manual review routing.
   */
  FUNCTION FN_RISK_SCORE(
    p_cust_id      IN NUMBER,
    p_txn_id       IN NUMBER
  ) RETURN NUMBER;

  -- ══════════════════════════════════════════════════════════════════════════
  --  PROCEDURES
  -- ══════════════════════════════════════════════════════════════════════════

  /**
   * SP_CREATE_DISPUTE
   * Main entry point. Validates eligibility, computes risk, routes the
   * dispute (AUTO | MANUAL), inserts the DISPUTE row, and for AUTO routes
   * immediately calls SP_DECIDE to approve.
   */
  PROCEDURE SP_CREATE_DISPUTE(
    p_txn_id       IN  NUMBER,
    p_cust_id      IN  NUMBER,
    p_dispute_type IN  VARCHAR2,
    p_claim_amount IN  NUMBER,
    p_actor        IN  VARCHAR2,
    p_dispute_id   OUT NUMBER,
    p_status       OUT VARCHAR2,  -- 'OK' | 'ERROR'
    p_message      OUT VARCHAR2
  );

  /**
   * SP_DECIDE
   * Applies a decision to an existing dispute.
   * p_decision: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW'
   */
  PROCEDURE SP_DECIDE(
    p_dispute_id   IN  NUMBER,
    p_decision     IN  VARCHAR2,
    p_actor        IN  VARCHAR2,
    p_notes        IN  VARCHAR2,
    p_status       OUT VARCHAR2,  -- 'OK' | 'ERROR'
    p_message      OUT VARCHAR2
  );

  /**
   * SP_REFUND
   * Initiates and completes a simulated refund for an APPROVED dispute.
   * Transitions: APPROVED -> REFUND_INITIATED -> REFUNDED
   */
  PROCEDURE SP_REFUND(
    p_dispute_id   IN  NUMBER,
    p_actor        IN  VARCHAR2,
    p_refund_id    OUT NUMBER,
    p_reference    OUT VARCHAR2,
    p_status       OUT VARCHAR2,  -- 'OK' | 'ERROR'
    p_message      OUT VARCHAR2
  );

  /**
   * SP_AUDIT_EVENT
   * Inserts a row into DISPUTE_EVENTS. Called within other procedures —
   * shares the caller's transaction (no autonomous_transaction).
   */
  PROCEDURE SP_AUDIT_EVENT(
    p_dispute_id   IN NUMBER,
    p_event_type   IN VARCHAR2,
    p_actor        IN VARCHAR2,
    p_notes        IN VARCHAR2
  );

END PKG_DISPUTE;
/

SHOW ERRORS PACKAGE PKG_DISPUTE;
