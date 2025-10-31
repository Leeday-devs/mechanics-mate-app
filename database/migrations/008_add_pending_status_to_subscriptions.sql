-- Migration 008: Add 'pending' status to subscription status check constraint
-- Description: The application tries to create subscriptions with status='pending'
-- while waiting for Stripe webhook confirmation, but the database constraint
-- only allows 'active', 'canceled', 'past_due', 'trialing', 'incomplete'.
-- This migration fixes the constraint to include 'pending'.
--
-- Issue: Error - "new row for relation subscriptions violates check constraint subscriptions_status_check"
-- Root Cause: Database CHECK constraint doesn't allow 'pending' status value
-- Solution: Drop old constraint and create new one with 'pending' included

-- Drop the old constraint
ALTER TABLE public.subscriptions
DROP CONSTRAINT subscriptions_status_check;

-- Add the new constraint with 'pending' status included
ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_status_check
CHECK (status IN ('pending', 'active', 'canceled', 'past_due', 'trialing', 'incomplete'));

-- Update the comment to document this status
COMMENT ON COLUMN public.subscriptions.status IS 'Stripe subscription status: pending (awaiting webhook), active, canceled, past_due, trialing, incomplete';

-- Note: There should be NO existing subscriptions with 'pending' status
-- since they couldn't have been created before this fix
