-- =============================================================================
-- 05_seed.sql  —  Reference/Seed data
-- 3 customers, 3 accounts, 5 transactions
-- =============================================================================

-- Disable constraints momentarily if needed (not required — inserting in order)
-- ---------------------------------------------------------------------------
-- CUSTOMERS
-- ---------------------------------------------------------------------------
INSERT INTO CUSTOMERS (full_name, email, phone, kyc_status)
VALUES ('Priya Sharma', 'priya.sharma@example.com', '+91-9000000001', 'FULL');

INSERT INTO CUSTOMERS (full_name, email, phone, kyc_status)
VALUES ('Rahul Mehta', 'rahul.mehta@example.com', '+91-9000000002', 'PARTIAL');

INSERT INTO CUSTOMERS (full_name, email, phone, kyc_status)
VALUES ('Aisha Khan', 'aisha.khan@example.com', '+91-9000000003', 'NONE');

-- ---------------------------------------------------------------------------
-- ACCOUNTS  (one per customer, balance = 50000 INR)
-- ---------------------------------------------------------------------------
INSERT INTO ACCOUNTS (customer_id, account_no, account_type, balance, currency, status)
SELECT customer_id, 'ACCT-PRIYA-001', 'SAVINGS', 50000, 'INR', 'ACTIVE'
  FROM CUSTOMERS WHERE email = 'priya.sharma@example.com';

INSERT INTO ACCOUNTS (customer_id, account_no, account_type, balance, currency, status)
SELECT customer_id, 'ACCT-RAHUL-001', 'SAVINGS', 50000, 'INR', 'ACTIVE'
  FROM CUSTOMERS WHERE email = 'rahul.mehta@example.com';

INSERT INTO ACCOUNTS (customer_id, account_no, account_type, balance, currency, status)
SELECT customer_id, 'ACCT-AISHA-001', 'SAVINGS', 50000, 'INR', 'ACTIVE'
  FROM CUSTOMERS WHERE email = 'aisha.khan@example.com';

-- ---------------------------------------------------------------------------
-- TRANSACTIONS
-- acct1 = Priya, acct2 = Rahul, acct3 = Aisha
-- ---------------------------------------------------------------------------

-- txn1: acct1 (Priya), 2500, SETTLED, Swiggy, SYSDATE-5
INSERT INTO TRANSACTIONS (account_id, txn_type, amount, currency, merchant_name, txn_reference, status, txn_ts)
SELECT account_id, 'DEBIT', 2500, 'INR', 'Swiggy', 'TXN-REF-0001', 'SETTLED',
       SYSTIMESTAMP - INTERVAL '5' DAY
  FROM ACCOUNTS WHERE account_no = 'ACCT-PRIYA-001';

-- txn2: acct1 (Priya), 8000, SETTLED, Amazon, SYSDATE-10
INSERT INTO TRANSACTIONS (account_id, txn_type, amount, currency, merchant_name, txn_reference, status, txn_ts)
SELECT account_id, 'DEBIT', 8000, 'INR', 'Amazon', 'TXN-REF-0002', 'SETTLED',
       SYSTIMESTAMP - INTERVAL '10' DAY
  FROM ACCOUNTS WHERE account_no = 'ACCT-PRIYA-001';

-- txn3: acct2 (Rahul), 1200, SETTLED, Zomato, SYSDATE-3
INSERT INTO TRANSACTIONS (account_id, txn_type, amount, currency, merchant_name, txn_reference, status, txn_ts)
SELECT account_id, 'DEBIT', 1200, 'INR', 'Zomato', 'TXN-REF-0003', 'SETTLED',
       SYSTIMESTAMP - INTERVAL '3' DAY
  FROM ACCOUNTS WHERE account_no = 'ACCT-RAHUL-001';

-- txn4: acct2 (Rahul), 15000, SETTLED, Flipkart, SYSDATE-20
INSERT INTO TRANSACTIONS (account_id, txn_type, amount, currency, merchant_name, txn_reference, status, txn_ts)
SELECT account_id, 'DEBIT', 15000, 'INR', 'Flipkart', 'TXN-REF-0004', 'SETTLED',
       SYSTIMESTAMP - INTERVAL '20' DAY
  FROM ACCOUNTS WHERE account_no = 'ACCT-RAHUL-001';

-- txn5: acct3 (Aisha), 500, REVERSED, PayTM, SYSDATE-1
INSERT INTO TRANSACTIONS (account_id, txn_type, amount, currency, merchant_name, txn_reference, status, txn_ts)
SELECT account_id, 'DEBIT', 500, 'INR', 'PayTM', 'TXN-REF-0005', 'REVERSED',
       SYSTIMESTAMP - INTERVAL '1' DAY
  FROM ACCOUNTS WHERE account_no = 'ACCT-AISHA-001';

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification query (print to console)
-- ---------------------------------------------------------------------------
SELECT 'CUSTOMERS' AS tbl, COUNT(*) AS cnt FROM CUSTOMERS
UNION ALL
SELECT 'ACCOUNTS',  COUNT(*) FROM ACCOUNTS
UNION ALL
SELECT 'TRANSACTIONS', COUNT(*) FROM TRANSACTIONS;

-- Show transaction IDs for use in API tests
SELECT t.txn_id, a.account_no, c.full_name, t.amount,
       t.merchant_name, t.status, t.txn_ts
  FROM TRANSACTIONS t
  JOIN ACCOUNTS  a ON a.account_id   = t.account_id
  JOIN CUSTOMERS c ON c.customer_id  = a.customer_id
 ORDER BY t.txn_id;
