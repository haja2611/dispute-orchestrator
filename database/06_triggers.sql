-- =============================================================================
-- 06_triggers.sql  —  Audit / housekeeping triggers
-- =============================================================================
SET DEFINE OFF;
ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = SYSTEM;

-- ---------------------------------------------------------------------------
-- Auto-update CUSTOMERS.updated_at on any row change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_cust_updated_at
  BEFORE UPDATE ON CUSTOMERS
  FOR EACH ROW
BEGIN
  :NEW.updated_at := SYSTIMESTAMP;
END;
/

-- ---------------------------------------------------------------------------
-- Auto-update ACCOUNTS.updated_at on any row change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_acct_updated_at
  BEFORE UPDATE ON ACCOUNTS
  FOR EACH ROW
BEGIN
  :NEW.updated_at := SYSTIMESTAMP;
END;
/

-- ---------------------------------------------------------------------------
-- Auto-update DISPUTES.updated_at on any row change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_disp_updated_at
  BEFORE UPDATE ON DISPUTES
  FOR EACH ROW
BEGIN
  :NEW.updated_at := SYSTIMESTAMP;
END;
/

-- ---------------------------------------------------------------------------
-- Auto-update REFUNDS.updated_at on any row change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_refund_updated_at
  BEFORE UPDATE ON REFUNDS
  FOR EACH ROW
BEGIN
  :NEW.updated_at := SYSTIMESTAMP;
END;
/

-- ---------------------------------------------------------------------------
-- Prevent INSERT on DISPUTE_EVENTS with NULL dispute_id
-- (belt-and-suspenders on top of FK constraint)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_evt_validate
  BEFORE INSERT ON DISPUTE_EVENTS
  FOR EACH ROW
BEGIN
  IF :NEW.dispute_id IS NULL THEN
    RAISE_APPLICATION_ERROR(-20010, '[AUDIT] dispute_id cannot be NULL in DISPUTE_EVENTS');
  END IF;
  IF :NEW.event_type IS NULL OR LENGTH(TRIM(:NEW.event_type)) = 0 THEN
    RAISE_APPLICATION_ERROR(-20011, '[AUDIT] event_type cannot be empty in DISPUTE_EVENTS');
  END IF;
END;
/

COMMIT;
