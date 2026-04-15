-- =============================================================================
-- 01_schema.sql  —  Smart Dispute & Refund Orchestrator
-- Oracle 23c Free  |  Run as SYSTEM in FREEPDB1
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CUSTOMERS
-- ---------------------------------------------------------------------------
CREATE TABLE CUSTOMERS (
    customer_id   NUMBER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name     VARCHAR2(100) NOT NULL,
    email         VARCHAR2(150) NOT NULL CONSTRAINT uq_cust_email UNIQUE,
    phone         VARCHAR2(20),
    kyc_status    VARCHAR2(10)  DEFAULT 'NONE'
                  CONSTRAINT chk_kyc CHECK (kyc_status IN ('FULL','PARTIAL','NONE')),
    created_at    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------------
-- ACCOUNTS
-- ---------------------------------------------------------------------------
CREATE TABLE ACCOUNTS (
    account_id    NUMBER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id   NUMBER        NOT NULL
                  CONSTRAINT fk_acct_cust REFERENCES CUSTOMERS(customer_id),
    account_no    VARCHAR2(20)  NOT NULL CONSTRAINT uq_acct_no UNIQUE,
    account_type  VARCHAR2(20)  DEFAULT 'SAVINGS'
                  CONSTRAINT chk_acct_type CHECK (account_type IN ('SAVINGS','CURRENT','WALLET')),
    balance       NUMBER(15,2)  DEFAULT 0 NOT NULL,
    currency      VARCHAR2(3)   DEFAULT 'INR' NOT NULL,
    status        VARCHAR2(10)  DEFAULT 'ACTIVE'
                  CONSTRAINT chk_acct_status CHECK (status IN ('ACTIVE','DORMANT','CLOSED')),
    created_at    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX idx_acct_customer ON ACCOUNTS(customer_id);

-- ---------------------------------------------------------------------------
-- TRANSACTIONS
-- ---------------------------------------------------------------------------
CREATE TABLE TRANSACTIONS (
    txn_id        NUMBER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id    NUMBER        NOT NULL
                  CONSTRAINT fk_txn_acct REFERENCES ACCOUNTS(account_id),
    txn_type      VARCHAR2(20)  DEFAULT 'DEBIT'
                  CONSTRAINT chk_txn_type CHECK (txn_type IN ('DEBIT','CREDIT','REVERSAL')),
    amount        NUMBER(15,2)  NOT NULL,
    currency      VARCHAR2(3)   DEFAULT 'INR' NOT NULL,
    merchant_name VARCHAR2(100),
    txn_reference VARCHAR2(50),
    status        VARCHAR2(20)  DEFAULT 'SETTLED'
                  CONSTRAINT chk_txn_status CHECK
                    (status IN ('PENDING','SETTLED','REVERSED','CHARGEBACK_DONE','FAILED')),
    txn_ts        TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    created_at    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX idx_txn_account ON TRANSACTIONS(account_id);
CREATE INDEX idx_txn_status  ON TRANSACTIONS(status);
CREATE INDEX idx_txn_ts      ON TRANSACTIONS(txn_ts);

-- ---------------------------------------------------------------------------
-- DISPUTES
-- ---------------------------------------------------------------------------
CREATE TABLE DISPUTES (
    dispute_id    NUMBER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    txn_id        NUMBER        NOT NULL
                  CONSTRAINT fk_disp_txn REFERENCES TRANSACTIONS(txn_id),
    customer_id   NUMBER        NOT NULL
                  CONSTRAINT fk_disp_cust REFERENCES CUSTOMERS(customer_id),
    dispute_type  VARCHAR2(30)  NOT NULL
                  CONSTRAINT chk_disp_type CHECK
                    (dispute_type IN
                      ('DUPLICATE_CHARGE','SERVICE_NOT_DELIVERED','WRONG_AMOUNT','FRAUD_SUSPECTED')),
    claim_amount  NUMBER(15,2)  NOT NULL,
    status        VARCHAR2(20)  DEFAULT 'PENDING_REVIEW'
                  CONSTRAINT chk_disp_status CHECK
                    (status IN
                      ('PENDING_REVIEW','APPROVED','REJECTED',
                       'REFUND_INITIATED','REFUNDED','CLOSED')),
    risk_score    NUMBER(3)     DEFAULT 0,
    routing       VARCHAR2(10)  DEFAULT 'AUTO'
                  CONSTRAINT chk_disp_routing CHECK (routing IN ('AUTO','MANUAL')),
    actor         VARCHAR2(100),
    notes         VARCHAR2(1000),
    created_at    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX idx_disp_txn      ON DISPUTES(txn_id);
CREATE INDEX idx_disp_customer ON DISPUTES(customer_id);
CREATE INDEX idx_disp_status   ON DISPUTES(status);
CREATE INDEX idx_disp_created  ON DISPUTES(created_at);

-- ---------------------------------------------------------------------------
-- REFUNDS
-- ---------------------------------------------------------------------------
CREATE TABLE REFUNDS (
    refund_id       NUMBER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dispute_id      NUMBER        NOT NULL
                    CONSTRAINT fk_refund_disp REFERENCES DISPUTES(dispute_id),
    reference_no    VARCHAR2(50)  NOT NULL CONSTRAINT uq_refund_ref UNIQUE,
    refund_amount   NUMBER(15,2)  NOT NULL,
    refund_status   VARCHAR2(20)  DEFAULT 'INITIATED'
                    CONSTRAINT chk_refund_status CHECK
                      (refund_status IN ('INITIATED','PROCESSING','COMPLETED','FAILED')),
    initiated_by    VARCHAR2(100),
    initiated_at    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at      TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX idx_refund_dispute ON REFUNDS(dispute_id);

-- ---------------------------------------------------------------------------
-- DISPUTE_EVENTS  (immutable audit trail — never UPDATE/DELETE)
-- ---------------------------------------------------------------------------
CREATE TABLE DISPUTE_EVENTS (
    event_id      NUMBER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dispute_id    NUMBER        NOT NULL
                  CONSTRAINT fk_evt_disp REFERENCES DISPUTES(dispute_id),
    event_type    VARCHAR2(50)  NOT NULL,
    actor         VARCHAR2(100),
    notes         VARCHAR2(2000),
    created_at    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX idx_evt_dispute ON DISPUTE_EVENTS(dispute_id);
CREATE INDEX idx_evt_type    ON DISPUTE_EVENTS(event_type);
CREATE INDEX idx_evt_created ON DISPUTE_EVENTS(created_at);

-- Prevent any UPDATE or DELETE on the audit table
CREATE OR REPLACE TRIGGER trg_no_dml_events
  BEFORE UPDATE OR DELETE ON DISPUTE_EVENTS
  FOR EACH ROW
BEGIN
  RAISE_APPLICATION_ERROR(-20099, '[AUDIT] DISPUTE_EVENTS rows are immutable');
END;
/

-- ---------------------------------------------------------------------------
-- Helpful view — full dispute detail
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW V_DISPUTE_FULL AS
SELECT
    d.dispute_id,
    d.txn_id,
    d.customer_id,
    c.full_name      AS customer_name,
    c.kyc_status,
    t.merchant_name,
    t.amount         AS txn_amount,
    t.txn_ts,
    t.status         AS txn_status,
    d.dispute_type,
    d.claim_amount,
    d.status         AS dispute_status,
    d.risk_score,
    d.routing,
    d.actor,
    d.notes,
    d.created_at,
    d.updated_at
FROM   DISPUTES   d
JOIN   TRANSACTIONS t ON t.txn_id       = d.txn_id
JOIN   CUSTOMERS    c ON c.customer_id  = d.customer_id;

COMMIT;
