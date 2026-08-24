-- Vue 1 : portefeuille de prets a risque (au moins une echeance en retard)
CREATE OR REPLACE VIEW v_loan_portfolio_at_risk AS
SELECT
  l.id AS loan_id,
  l."loanNumber" AS loan_number,
  l."branchId" AS branch_id,
  l."clientId" AS client_id,
  l.principal,
  l.status,
  COUNT(ls.id) AS overdue_installments_count,
  SUM(ls."amountDue") AS overdue_amount
FROM loans l
JOIN "loan_schedules" ls ON ls."loanId" = l.id AND ls.status = 'OVERDUE'
WHERE l.status = 'DISBURSED'
GROUP BY l.id;

-- Vue 2 : resume quotidien par agence
CREATE OR REPLACE VIEW v_branch_daily_summary AS
SELECT
  b.id AS branch_id,
  b.name AS branch_name,
  DATE(t."createdAt") AS summary_date,
  COUNT(t.id) AS transaction_count,
  SUM(CASE WHEN t.type = 'DEPOSIT' THEN t.amount ELSE 0 END) AS total_deposits,
  SUM(CASE WHEN t.type = 'WITHDRAWAL' THEN t.amount ELSE 0 END) AS total_withdrawals,
  SUM(CASE WHEN t.type = 'LOAN_DISBURSEMENT' THEN t.amount ELSE 0 END) AS total_disbursements,
  SUM(CASE WHEN t.type = 'LOAN_REPAYMENT' THEN t.amount ELSE 0 END) AS total_repayments
FROM branches b
LEFT JOIN transactions t ON t."branchId" = b.id AND t.status = 'COMPLETED'
GROUP BY b.id, DATE(t."createdAt");

-- Vue 3 : vue d'ensemble d'un client (epargne, prets, tontines)
CREATE OR REPLACE VIEW v_client_overview AS
SELECT
  c.id AS client_id,
  c."clientNumber" AS client_number,
  c."firstName" AS first_name,
  c."lastName" AS last_name,
  c."branchId" AS branch_id,
  c."assignedAgentId" AS assigned_agent_id,
  COALESCE(sa.total_savings, 0) AS total_savings,
  COALESCE(l.active_loans_count, 0) AS active_loans_count,
  COALESCE(l.total_owed, 0) AS total_owed,
  COALESCE(tc.active_tontines_count, 0) AS active_tontines_count
FROM clients c
LEFT JOIN (
  SELECT "clientId", SUM(balance) AS total_savings
  FROM "savings_accounts" WHERE status = 'ACTIVE' GROUP BY "clientId"
) sa ON sa."clientId" = c.id
LEFT JOIN (
  SELECT l."clientId",
    COUNT(*) AS active_loans_count,
    SUM(ls."amountDue") AS total_owed
  FROM loans l
  JOIN "loan_schedules" ls ON ls."loanId" = l.id AND ls.status IN ('PENDING', 'OVERDUE')
  WHERE l.status = 'DISBURSED'
  GROUP BY l."clientId"
) l ON l."clientId" = c.id
LEFT JOIN (
  SELECT "clientId", COUNT(*) AS active_tontines_count
  FROM "tontine_cycles" WHERE status = 'ACTIVE' GROUP BY "clientId"
) tc ON tc."clientId" = c.id
WHERE c."deletedAt" IS NULL;

-- Vue 4 : collectes du jour pour un agent (tontines + echeances de prets dues aujourd'hui)
CREATE OR REPLACE VIEW v_agent_daily_collections AS
SELECT
  'TONTINE' AS collection_type,
  tcol.id AS collection_id,
  tc."clientId" AS client_id,
  c."assignedAgentId" AS assigned_agent_id,
  tc."branchId" AS branch_id,
  tcol."scheduledDate" AS due_date,
  tc."amountPerCollection" AS amount_due,
  tcol.status::text
FROM "tontine_collections" tcol
JOIN "tontine_cycles" tc ON tc.id = tcol."cycleId"
JOIN clients c ON c.id = tc."clientId"
WHERE DATE(tcol."scheduledDate") = CURRENT_DATE AND tcol.status::text = 'A_COLLECTER'

UNION ALL

SELECT
  'LOAN' AS collection_type,
  ls.id AS collection_id,
  l."clientId" AS client_id,
  c."assignedAgentId" AS assigned_agent_id,
  l."branchId" AS branch_id,
  ls."dueDate" AS due_date,
  ls."amountDue" AS amount_due,
  ls.status::text
FROM "loan_schedules" ls
JOIN loans l ON l.id = ls."loanId"
JOIN clients c ON c.id = l."clientId"
WHERE DATE(ls."dueDate") = CURRENT_DATE AND ls.status = 'PENDING';

