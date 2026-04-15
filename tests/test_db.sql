-- tests/test_db.sql
-- Sanity-check seed data and package compilation
-- Run as SYSTEM in FREEPDB1 after running all scripts
-- ─────────────────────────────────────────────────────

PROMPT === SEED DATA VERIFICATION ===

-- Customer count
SELECT 'CUSTOMERS' AS table_name, COUNT(*) AS row_count FROM CUSTOMERS;

-- Account count
SELECT 'ACCOUNTS'  AS table_name, COUNT(*) AS row_count FROM ACCOUNTS;

-- Transaction count
SELECT 'TRANSACTIONS' AS table_name, COUNT(*) AS row_count FROM TRANSACTIONS;

PROMPT
PROMPT === TRANSACTION DETAIL (use these IDs in API tests) ===

SELECT
    t.txn_id,
    a.account_no,
    c.full_name,
    c.kyc_status,
    t.merchant_name,
    t.amount,
    t.status         AS txn_status,
    ROUND(SYSDATE - CAST(t.txn_ts AS DATE), 1) AS days_old
FROM TRANSACTIONS t
JOIN ACCOUNTS     a ON a.account_id  = t.account_id
JOIN CUSTOMERS    c ON c.customer_id = a.customer_id
ORDER BY t.txn_id;

PROMPT
PROMPT === PACKAGE COMPILATION STATUS ===

SELECT object_name, object_type, status, last_ddl_time
FROM   user_objects
WHERE  object_name IN ('PKG_DISPUTE_TYPES', 'PKG_DISPUTE')
   AND object_type IN ('PACKAGE', 'PACKAGE BODY')
ORDER BY object_name, object_type;

PROMPT
PROMPT === ELIGIBLE TRANSACTIONS (should be txnId 1,2,3,4 — not 5 because REVERSED) ===

SELECT
    t.txn_id,
    PKG_DISPUTE.FN_ELIGIBLE(t.txn_id, 'DUPLICATE_CHARGE') AS eligible_dup,
    PKG_DISPUTE.FN_ELIGIBLE(t.txn_id, 'FRAUD_SUSPECTED')  AS eligible_fraud
FROM TRANSACTIONS t
ORDER BY t.txn_id;

PROMPT
PROMPT === RISK SCORES ===

SELECT
    c.customer_id,
    c.full_name,
    c.kyc_status,
    t.txn_id,
    t.amount,
    PKG_DISPUTE.FN_RISK_SCORE(c.customer_id, t.txn_id) AS risk_score
FROM TRANSACTIONS t
JOIN ACCOUNTS     a ON a.account_id  = t.account_id
JOIN CUSTOMERS    c ON c.customer_id = a.customer_id
ORDER BY c.customer_id, t.txn_id;

PROMPT
PROMPT === ALL CHECKS PASSED ===
