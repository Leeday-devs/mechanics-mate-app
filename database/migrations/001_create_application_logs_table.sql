/**
 * Application Logs Table Migration
 *
 * Creates the application_logs table for comprehensive logging and monitoring
 * Run this migration in your Supabase database to set up the logging infrastructure
 */

-- Create enum types for log_type and severity
CREATE TYPE log_type AS ENUM (
    'login',
    'error',
    'api_call',
    'payment',
    'chat',
    'admin_action',
    'warning',
    'subscription',
    'security'
);

CREATE TYPE log_severity AS ENUM (
    'info',
    'warning',
    'error',
    'critical'
);

-- Create the main application_logs table
CREATE TABLE IF NOT EXISTS application_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    log_type log_type NOT NULL,
    severity log_severity DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    error_stack TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_application_logs_user_id ON application_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_log_type ON application_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_application_logs_severity ON application_logs(severity);
CREATE INDEX IF NOT EXISTS idx_application_logs_created_at ON application_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_application_logs_endpoint ON application_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_application_logs_status_code ON application_logs(status_code);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_application_logs_type_severity_date
    ON application_logs(log_type, severity, created_at DESC);

-- Create a text search index for searching in title and message
CREATE INDEX IF NOT EXISTS idx_application_logs_text_search
    ON application_logs USING GIN(to_tsvector('english', title || ' ' || COALESCE(message, '')));

-- Enable Row Level Security
ALTER TABLE application_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view all logs
CREATE POLICY admin_view_all_logs ON application_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.user_id = auth.uid()
        )
    );

-- RLS Policy: Users can view their own logs (for their user_id)
CREATE POLICY user_view_own_logs ON application_logs
    FOR SELECT
    USING (user_id = auth.uid());

-- RLS Policy: Service role can insert logs
CREATE POLICY insert_logs ON application_logs
    FOR INSERT
    WITH CHECK (true);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating updated_at
CREATE TRIGGER update_application_logs_updated_at
    BEFORE UPDATE ON application_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a view for recent errors (useful for admin dashboard)
CREATE OR REPLACE VIEW recent_errors AS
SELECT
    id,
    user_id,
    title,
    message,
    endpoint,
    status_code,
    severity,
    created_at
FROM application_logs
WHERE severity IN ('error', 'critical')
ORDER BY created_at DESC
LIMIT 50;

-- Create a view for login activity
CREATE OR REPLACE VIEW login_activity AS
SELECT
    id,
    user_id,
    status_code,
    ip_address,
    user_agent,
    metadata,
    created_at
FROM application_logs
WHERE log_type = 'login'
ORDER BY created_at DESC;

-- Create a view for failed logins (security monitoring)
CREATE OR REPLACE VIEW failed_login_attempts AS
SELECT
    id,
    user_id,
    ip_address,
    user_agent,
    metadata,
    created_at
FROM application_logs
WHERE log_type = 'login' AND status_code = 401
ORDER BY created_at DESC;

-- Create a function to delete old logs (for log retention)
CREATE OR REPLACE FUNCTION cleanup_old_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM application_logs
    WHERE created_at < (CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL)
    AND severity != 'critical';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to the service role (for logging from the backend)
GRANT ALL PRIVILEGES ON TABLE application_logs TO service_role;
GRANT ALL PRIVILEGES ON TYPE log_type TO service_role;
GRANT ALL PRIVILEGES ON TYPE log_severity TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
