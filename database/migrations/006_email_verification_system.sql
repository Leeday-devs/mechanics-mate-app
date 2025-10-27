-- Email Verification System
-- Tracks email verification tokens and verified status for users

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE
);

-- Alter auth.users table to add email_verified column if it doesn't exist
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Create index on token for fast lookups during verification
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);

-- Create index on user_id for cleanup queries
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);

-- Create index on token expiration for cleanup
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires ON email_verification_tokens(token_expires_at);

-- Enable RLS (Row Level Security)
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY IF NOT EXISTS "service_role_email_verification" ON email_verification_tokens
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
