-- Fix clients created via onboarding form where installment_amount was incorrectly
-- set to total_amount instead of the per-installment amount.
-- Only affects multi-installment clients where both values are equal (the bug condition).
UPDATE crm_clients
SET installment_amount = total_amount / num_installments
WHERE num_installments > 1
  AND installment_amount = total_amount;
