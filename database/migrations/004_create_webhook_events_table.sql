-- Create webhook_events table for idempotency
-- Prevents duplicate processing of Stripe webhook events

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE, -- Stripe event ID (e.g., evt_1234567890)
    event_type TEXT NOT NULL,      -- Event type (e.g., customer.subscription.created)
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data JSONB NOT NULL,           -- Full webhook event data for debugging
    status TEXT DEFAULT 'processed' -- 'processed' or 'failed'
);

-- Create index on event_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);

-- Create index on processed_at for cleanup queries (old events)
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events(processed_at);

-- Enable RLS (Row Level Security)
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "service_role_webhook_access" ON webhook_events
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
