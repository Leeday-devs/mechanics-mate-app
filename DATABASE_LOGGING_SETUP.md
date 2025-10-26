# Database Logging Setup Guide

This guide creates a comprehensive logging system to track all important events in your application.

## 1. Create Logs Table in Supabase

Run this SQL in your Supabase SQL Editor:

```sql
-- Create logs table for comprehensive application logging
CREATE TABLE IF NOT EXISTS application_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    log_type TEXT NOT NULL, -- 'login', 'error', 'api_call', 'payment', 'chat', 'admin_action', 'warning'
    severity TEXT DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
    title TEXT NOT NULL, -- Short description
    message TEXT, -- Detailed message
    endpoint TEXT, -- API endpoint that was called
    method TEXT, -- GET, POST, PUT, DELETE, etc
    status_code INTEGER, -- HTTP status code
    ip_address TEXT, -- Client IP address
    user_agent TEXT, -- Browser/client information
    metadata JSONB, -- Additional context (error details, user data, etc)
    error_stack TEXT, -- Stack trace for errors
    duration_ms INTEGER, -- How long the operation took
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_logs_user_id ON application_logs(user_id);
CREATE INDEX idx_logs_type ON application_logs(log_type);
CREATE INDEX idx_logs_severity ON application_logs(severity);
CREATE INDEX idx_logs_created_at ON application_logs(created_at DESC);
CREATE INDEX idx_logs_endpoint ON application_logs(endpoint);
CREATE INDEX idx_logs_status_code ON application_logs(status_code);

-- Enable Row Level Security for privacy
ALTER TABLE application_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can see all logs
CREATE POLICY "Admins can view all logs"
  ON application_logs
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users
    )
  );

-- Policy: Users can see their own logs
CREATE POLICY "Users can view their own logs"
  ON application_logs
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Policy: Service role can insert logs
CREATE POLICY "Service role can insert logs"
  ON application_logs
  FOR INSERT
  WITH CHECK (true);
```

## 2. What Gets Logged

### Login Events
- Successful login
- Failed login attempts
- Logout
- Token refresh
- Password changes

### Error Events
- API errors
- Database errors
- Payment processing errors
- Authentication errors
- Validation errors

### API Call Events
- Chat messages sent
- Subscription changes
- Payment processing
- Admin actions
- File operations

### Payment Events
- Checkout session created
- Payment succeeded
- Payment failed
- Subscription created/updated/canceled
- Invoice payment

### Admin Actions
- User access to admin dashboard
- Admin stats viewed
- User data accessed
- System configuration changes

## 3. Log Types

```
'login'         - User authentication events
'logout'        - User logout
'error'         - Application errors
'warning'       - Warning conditions
'api_call'      - API endpoint calls
'payment'       - Payment processing
'chat'          - Chat messages
'admin_action'  - Admin operations
'subscription'  - Subscription changes
'security'      - Security-related events
```

## 4. Severity Levels

```
'info'          - Informational messages
'warning'       - Warning conditions (should investigate)
'error'         - Error conditions (something failed)
'critical'      - Critical issues (immediate action needed)
```

## 5. Retention Policy

Logs are kept for:
- Last 90 days for all logs (default)
- Last 12 months for critical errors
- Last 6 months for payment events

You can clean up old logs with:

```sql
-- Delete logs older than 90 days
DELETE FROM application_logs
WHERE created_at < NOW() - INTERVAL '90 days'
AND severity != 'critical';

-- Delete old non-critical payment logs
DELETE FROM application_logs
WHERE created_at < NOW() - INTERVAL '180 days'
AND log_type NOT IN ('critical', 'payment');
```

Set this as a scheduled job in Supabase.

## 6. Querying Logs

### Get recent errors
```sql
SELECT * FROM application_logs
WHERE severity = 'error'
ORDER BY created_at DESC
LIMIT 50;
```

### Get failed logins for a user
```sql
SELECT * FROM application_logs
WHERE log_type = 'login'
AND user_id = 'user-id'
AND status_code = 401
ORDER BY created_at DESC;
```

### Get API performance issues
```sql
SELECT endpoint, AVG(duration_ms) as avg_time, COUNT(*) as count
FROM application_logs
WHERE log_type = 'api_call'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY avg_time DESC;
```

### Get payment errors
```sql
SELECT * FROM application_logs
WHERE log_type = 'payment'
AND severity IN ('error', 'critical')
ORDER BY created_at DESC;
```

