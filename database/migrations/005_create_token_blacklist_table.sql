-- Create token_blacklist table for logout invalidation
-- Prevents reuse of JWT tokens after user logout

CREATE TABLE IF NOT EXISTS token_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_jti TEXT NOT NULL UNIQUE, -- JWT jti (JWT ID) claim for token tracking
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    blacklisted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- When the token would naturally expire
    reason TEXT DEFAULT 'logout' -- 'logout', 'password_changed', 'admin_revoke', etc.
);

-- Create index on token_jti for fast lookups
CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(token_jti);

-- Create index on user_id for cleanup queries
CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);

-- Create index on expires_at for cleanup (old blacklisted tokens)
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

-- Enable RLS (Row Level Security)
ALTER TABLE token_blacklist ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "service_role_blacklist_access" ON token_blacklist
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
