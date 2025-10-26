# Comprehensive Logging System Implementation

## Overview

The Mechanics Mate application now includes a comprehensive logging system that tracks all important events, errors, and user activity. This system helps with debugging, monitoring, and compliance by providing visibility into application behavior.

## What Gets Logged

### Log Types

1. **login** - User authentication events (successful and failed attempts)
2. **error** - Application errors and exceptions
3. **api_call** - All API endpoints accessed (measured with duration)
4. **payment** - Stripe payment events and subscription updates
5. **chat** - AI chat messages and response metrics
6. **admin_action** - Administrative actions performed
7. **subscription** - Subscription lifecycle events
8. **security** - Suspicious activity detection
9. **warning** - Warning-level events

### Severity Levels

- **info** - General information, successful operations
- **warning** - Non-critical issues that should be reviewed
- **error** - Failed operations that need attention
- **critical** - Severe issues requiring immediate action

## Implementation Details

### 1. Database Setup

#### Step 1: Create the Database Table

Run the migration file to create the logging infrastructure in your Supabase database:

```bash
# The migration file is at: database/migrations/001_create_application_logs_table.sql
# Copy and paste the entire contents into your Supabase SQL Editor
# https://app.supabase.com -> SQL Editor -> New Query
```

This creates:
- `application_logs` table with all necessary columns
- Enum types for log_type and severity
- Indexes for query performance
- Row Level Security (RLS) policies
- Views for common queries (recent_errors, login_activity, failed_login_attempts)
- Utility functions for log cleanup

#### Step 2: Verify the Table

After running the migration, verify the table was created:

```sql
SELECT * FROM application_logs LIMIT 1;
```

### 2. Core Components

#### Logger Utility (`lib/logger.js`)

The central logging utility with these methods:

```javascript
// Login/logout tracking
logger.logLogin({ userId, email, success, ipAddress, userAgent, reason })
logger.logLogout({ userId, email, ipAddress, userAgent })

// API call tracking
logger.logApiCall({ userId, endpoint, method, statusCode, durationMs, ipAddress, userAgent })

// Error tracking
logger.logError({ userId, title, message, error, endpoint, method, statusCode, ipAddress, userAgent })

// Payment tracking
logger.logPayment({ userId, eventType, stripePlan, amount, success, message })

// Chat tracking
logger.logChat({ userId, messageLength, tokensUsed, costGBP, success, message })

// Subscription tracking
logger.logSubscription({ userId, eventType, planId, status, message })

// Admin actions
logger.logAdminAction({ userId, action, targetUserId, details })

// Security events
logger.logSecurity({ userId, eventType, severity, message, metadata })
```

**Key Features:**
- Buffered writes for performance (5-second flush interval)
- Automatic timestamps and metadata
- Graceful shutdown with log flushing
- Error handling to prevent logging failures from breaking the app

#### Logging Middleware (`middleware/logger.js`)

Automatically logs:
- All API requests with method, endpoint, status code, and duration
- Error events with stack traces
- Suspicious activity (eval, exec, script injection attempts)

**Note:** Webhook endpoints are excluded to reduce noise.

#### Admin Routes (`routes/logs.js`)

RESTful endpoints for retrieving and analyzing logs:

```
GET  /api/logs                      - List logs with filtering and pagination
GET  /api/logs/user/:userId         - Logs for a specific user
GET  /api/logs/stats/summary        - Statistics (errors, failed logins, response times)
GET  /api/logs/stats/by-type        - Count logs by type
GET  /api/logs/stats/by-severity    - Count logs by severity
GET  /api/logs/recent-errors        - Most recent errors
DELETE /api/logs/cleanup            - Remove old logs (keep critical for 12 months)
```

**Query Parameters:**
- `limit` - Results per page (1-500, default 50)
- `page` - Page number (default 1)
- `type` - Filter by log type
- `severity` - Filter by severity
- `search` - Search in title/message
- `userId` - Filter by user
- `startDate` / `endDate` - Date range filtering
- `endpoint` - Filter by API endpoint
- `statusCode` - Filter by HTTP status code

### 3. Logged Events

#### Authentication (`routes/auth.js`)

- ✅ Successful login (with IP, user agent)
- ✅ Failed login attempts (with reason)
- ✅ Logout events
- ✅ Account creation

#### Payments & Subscriptions (`routes/subscriptions.js`)

- ✅ Checkout session creation
- ✅ Subscription creation/updates
- ✅ Payment success
- ✅ Payment failure
- ✅ Subscription cancellation
- ✅ Billing portal access

#### Chat (`server.js`)

- ✅ Successful chat messages (tokens used, cost, duration)
- ✅ Failed chat requests (with error details)
- ✅ Token usage tracking
- ✅ API cost calculation

#### API Calls (Automatic via middleware)

- ✅ All endpoint requests
- ✅ Response times
- ✅ HTTP status codes
- ✅ Client IP and user agent

#### Errors (Automatic via middleware)

- ✅ All exceptions caught
- ✅ Stack traces stored
- ✅ Severity determined by status code
- ✅ Request context included

## Admin Dashboard

The admin dashboard (`admin.html`) displays logs with:

### Features

1. **Real-time Log Viewing**
   - Displays last 50 logs sorted by newest first
   - Color-coded by severity (critical=red, error=red, warning=orange, info=blue)
   - Shows title, message, endpoint, status code, and timestamp

2. **Filtering & Search**
   - Filter by log type (login, error, api_call, payment, chat, admin_action)
   - Filter by severity (info, warning, error, critical)
   - Full-text search in log title and message
   - Real-time updates as you change filters

3. **Log Statistics (Last 24 Hours)**
   - Total errors count
   - Critical errors count
   - Total login attempts
   - Failed login attempts
   - Average API response time

4. **Auto-Refresh**
   - Dashboard automatically refreshes every 30 seconds
   - Logs are re-fetched based on current filters
   - Statistics update in real-time

### How to Use

1. Login as an admin user
2. Navigate to `/admin.html`
3. View all logs automatically loaded
4. Use filters to find specific issues:
   - **To debug API errors:** Filter by `type=error`
   - **To monitor logins:** Filter by `type=login`
   - **To check payment issues:** Filter by `type=payment`
   - **To review critical issues:** Filter by `severity=critical`
5. Search for specific keywords in log message/title
6. Click "Refresh" to manually reload logs

## Setup Instructions

### For Existing Deployments

1. **Run the Database Migration**
   ```sql
   -- Open Supabase SQL Editor
   -- Paste contents of: database/migrations/001_create_application_logs_table.sql
   -- Execute the query
   ```

2. **Verify Installation**
   ```bash
   # The logger utility is already imported in:
   # - server.js
   # - routes/auth.js
   # - routes/subscriptions.js
   # - middleware/logger.js

   # Verify in Supabase:
   SELECT COUNT(*) FROM application_logs;
   ```

3. **Test the System**
   - Create a user account (will log login event)
   - Start a chat (will log chat event)
   - Try to login with wrong password (will log failed login)
   - Go to admin panel and verify logs appear

### For New Deployments

1. Create the database table using the migration
2. All logging is automatically configured
3. Deploy the code to production
4. Logs will start appearing immediately

## Log Retention

Logs are stored with the following retention policy:

- **Critical errors**: 12 months
- **Other logs**: 90 days (default, configurable)

To clean up old logs manually:

```sql
-- Delete logs older than 90 days (except critical)
SELECT cleanup_old_logs(90);

-- Delete logs older than 30 days
SELECT cleanup_old_logs(30);
```

Or via the API (admin only):

```bash
DELETE /api/logs/cleanup?days=90
```

## Security Considerations

### Row Level Security (RLS)

- Admins can view all logs
- Regular users can view their own logs only
- Service role can insert logs

### Data Privacy

- Personal data (IP addresses, user agents) is stored for security monitoring
- Passwords and sensitive data are never logged
- Error messages are sanitized before logging
- User IDs are used instead of emails in most contexts

### Access Control

- All log endpoints require authentication
- Admin endpoints require admin role
- Rate limiting applies to prevent log spam
- Suspicious activity is automatically detected and logged

## Troubleshooting

### Logs Not Appearing

1. **Check if table exists:**
   ```sql
   SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_name = 'application_logs'
   );
   ```

2. **Check for RLS policy issues:**
   ```sql
   SELECT * FROM pg_policies
   WHERE tablename = 'application_logs';
   ```

3. **Verify service role permissions:**
   ```sql
   SELECT grantee, privilege_type
   FROM information_schema.role_table_grants
   WHERE table_name = 'application_logs';
   ```

### Performance Issues

1. **Check index usage:**
   ```sql
   SELECT schemaname, tablename, indexname
   FROM pg_indexes
   WHERE tablename = 'application_logs';
   ```

2. **Analyze query performance:**
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM application_logs
   WHERE log_type = 'login' AND created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC LIMIT 50;
   ```

3. **Clean up old logs if table is getting large:**
   ```sql
   SELECT cleanup_old_logs(30);
   ```

## API Examples

### Get Recent Errors

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/logs/recent-errors?limit=10"
```

### Get Login Statistics

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/logs/stats/summary?hours=24"
```

### Search for Specific Issue

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/logs?search=payment%20failed&severity=error"
```

### Get User's Activity

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/logs/user/USER_ID?limit=50"
```

## Monitoring Checklist

Daily:
- ✅ Check admin dashboard for critical errors
- ✅ Monitor failed login attempts
- ✅ Review payment errors if any

Weekly:
- ✅ Analyze error trends
- ✅ Check API performance (avg response time)
- ✅ Review security events

Monthly:
- ✅ Clean up old logs
- ✅ Analyze usage patterns
- ✅ Review subscription/payment statistics

## Future Enhancements

Potential improvements:
- Email alerts for critical errors
- Slack integration for real-time notifications
- Advanced analytics and trend analysis
- Log export functionality (CSV, JSON)
- Custom retention policies per log type
- Audit trail for admin actions only

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the migration file for SQL errors
3. Verify Supabase RLS policies are correctly set
4. Check application logs in server console

## Summary

The logging system is fully integrated and will automatically capture:
- All authentication events
- All API calls and their performance
- All payment transactions
- All chat interactions and costs
- All errors with full context
- All security events

Access logs anytime via the admin dashboard to monitor application health and troubleshoot issues.
