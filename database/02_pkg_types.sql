-- =============================================================================
-- 02_pkg_types.sql  —  PKG_DISPUTE_TYPES  (constants package, spec only)
-- =============================================================================
SET DEFINE OFF;
ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = SYSTEM;

CREATE OR REPLACE PACKAGE PKG_DISPUTE_TYPES AS

  -- ── Dispute type constants ─────────────────────────────────────────────
  C_TYPE_DUPLICATE   CONSTANT VARCHAR2(30) := 'DUPLICATE_CHARGE';
  C_TYPE_SERVICE     CONSTANT VARCHAR2(30) := 'SERVICE_NOT_DELIVERED';
  C_TYPE_WRONG       CONSTANT VARCHAR2(30) := 'WRONG_AMOUNT';
  C_TYPE_FRAUD       CONSTANT VARCHAR2(30) := 'FRAUD_SUSPECTED';

  -- ── Dispute status constants ───────────────────────────────────────────
  C_STATUS_PENDING   CONSTANT VARCHAR2(20) := 'PENDING_REVIEW';
  C_STATUS_APPROVED  CONSTANT VARCHAR2(20) := 'APPROVED';
  C_STATUS_REJECTED  CONSTANT VARCHAR2(20) := 'REJECTED';
  C_STATUS_REF_INIT  CONSTANT VARCHAR2(20) := 'REFUND_INITIATED';
  C_STATUS_REFUNDED  CONSTANT VARCHAR2(20) := 'REFUNDED';
  C_STATUS_CLOSED    CONSTANT VARCHAR2(20) := 'CLOSED';

  -- ── Routing constants ─────────────────────────────────────────────────
  C_ROUTE_AUTO       CONSTANT VARCHAR2(10) := 'AUTO';
  C_ROUTE_MANUAL     CONSTANT VARCHAR2(10) := 'MANUAL';

  -- ── Decision constants ────────────────────────────────────────────────
  C_DECISION_APPROVE CONSTANT VARCHAR2(20) := 'APPROVE';
  C_DECISION_REJECT  CONSTANT VARCHAR2(20) := 'REJECT';
  C_DECISION_MANUAL  CONSTANT VARCHAR2(20) := 'MANUAL_REVIEW';

  -- ── Auto-approval amount threshold (above this → MANUAL routing) ──────
  C_AUTO_THRESHOLD   CONSTANT NUMBER := 5000;

  -- ── Risk score threshold (above this → MANUAL routing) ──────────────
  C_RISK_THRESHOLD   CONSTANT NUMBER := 70;

  -- ── Eligibility windows (days from transaction date) ─────────────────
  C_WIN_DUPLICATE    CONSTANT NUMBER := 30;
  C_WIN_SERVICE      CONSTANT NUMBER := 15;
  C_WIN_WRONG        CONSTANT NUMBER := 7;
  C_WIN_FRAUD        CONSTANT NUMBER := 60;

  -- ── Event type constants ──────────────────────────────────────────────
  C_EVT_CREATED      CONSTANT VARCHAR2(50) := 'DISPUTE_CREATED';
  C_EVT_APPROVED     CONSTANT VARCHAR2(50) := 'DISPUTE_APPROVED';
  C_EVT_REJECTED     CONSTANT VARCHAR2(50) := 'DISPUTE_REJECTED';
  C_EVT_MANUAL       CONSTANT VARCHAR2(50) := 'SENT_TO_MANUAL_REVIEW';
  C_EVT_REF_INIT     CONSTANT VARCHAR2(50) := 'REFUND_INITIATED';
  C_EVT_REFUNDED     CONSTANT VARCHAR2(50) := 'REFUNDED';

  -- ── Custom error numbers (must be between -20000 and -20999) ─────────
  E_TXN_NOT_FOUND    CONSTANT NUMBER := -20001;
  E_TXN_RESOLVED     CONSTANT NUMBER := -20002;
  E_WINDOW_EXPIRED   CONSTANT NUMBER := -20003;
  E_ACTIVE_DISPUTE   CONSTANT NUMBER := -20004;
  E_INELIGIBLE       CONSTANT NUMBER := -20005;
  E_INVALID_STATUS   CONSTANT NUMBER := -20006;
  E_ALREADY_DECIDED  CONSTANT NUMBER := -20007;
  E_NOT_APPROVED     CONSTANT NUMBER := -20008;

END PKG_DISPUTE_TYPES;
/

SHOW ERRORS PACKAGE PKG_DISPUTE_TYPES;
