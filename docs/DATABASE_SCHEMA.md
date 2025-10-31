# Mechanics Mate - Database Schema Documentation

## Overview

Mechanics Mate uses **Supabase (PostgreSQL)** as its database backend. This document outlines all database tables, columns, relationships, and SQL scripts required to deploy the application.

**Database Provider:** Supabase (PostgreSQL 15+)
**Authentication:** Supabase Auth (built-in)
**Last Updated:** 18 October 2025

---

## Table of Contents

1. [Authentication (Supabase Auth)](#authentication-supabase-auth)
2. [Subscriptions Table](#subscriptions-table)
3. [Message Usage Table](#message-usage-table)
4. [Message History Table](#message-history-table)
5. [Admin Users Table](#admin-users-table)
6. [Complete SQL Schema](#complete-sql-schema)
7. [Row Level Security (RLS) Policies](#row-level-security-rls-policies)
8. [Indexes and Performance](#indexes-and-performance)
9. [Data Retention Policies](#data-retention-policies)

---

## Authentication (Supabase Auth)

Mechanics Mate uses Supabase's built-in authentication system (`auth.users` table). This is managed automatically by Supabase.

### User Metadata Stored:
- **Email**: Primary identifier
- **Password**: Hashed by Supabase
- **user_metadata.name**: User's display name (optional)
- **created_at**: Account creation timestamp
- **last_sign_in_at**: Last login timestamp

**No custom user table required** - all user data is in `auth.users`.

---

## Subscriptions Table

Stores subscription information for each user, linked to Stripe.

### Table Name: `subscriptions`

| Column Name              | Data Type          | Constraints               | Description                                    |
|--------------------------|--------------------|---------------------------|------------------------------------------------|
| `id`                     | `UUID`             | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique subscription record ID |
| `user_id`                | `UUID`             | UNIQUE, NOT NULL, FK → auth.users(id) | Reference to authenticated user |
| `stripe_customer_id`     | `TEXT`             | NOT NULL                  | Stripe customer ID                             |
| `stripe_subscription_id` | `TEXT`             | NOT NULL                  | Stripe subscription ID                         |
| `plan_id`                | `TEXT`             | NOT NULL                  | Plan type: 'starter', 'professional', 'workshop' |
| `status`                 | `TEXT`             | NOT NULL                  | Subscription status: 'pending', 'active', 'canceled', 'past_due', 'trialing', 'incomplete' |
| `current_period_start`   | `TIMESTAMPTZ`      | NOT NULL                  | Start of current billing period                |
| `current_period_end`     | `TIMESTAMPTZ`      | NOT NULL                  | End of current billing period                  |
| `cancel_at_period_end`   | `BOOLEAN`          | DEFAULT false             | Whether subscription cancels at period end     |
| `created_at`             | `TIMESTAMPTZ`      | DEFAULT now()             | Record creation timestamp                      |
| `updated_at`             | `TIMESTAMPTZ`      | DEFAULT now()             | Record last update timestamp                   |

### Relationships:
- **Foreign Key:** `user_id` → `auth.users(id)` (ON DELETE CASCADE)

### Notes:
- `user_id` is UNIQUE, ensuring one subscription per user
- Subscription updates are handled via Stripe webhooks
- `plan_id` values: 'starter', 'professional', 'workshop'
- `status` values: 'pending', 'active', 'canceled', 'past_due', 'trialing', 'incomplete'
- 'pending' = subscription created but payment not yet confirmed by Stripe webhook

---

## Message Usage Table

Tracks monthly message usage for quota enforcement.

### Table Name: `message_usage`

| Column Name      | Data Type     | Constraints                          | Description                                |
|------------------|---------------|--------------------------------------|--------------------------------------------|
| `id`             | `UUID`        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique usage record ID                  |
| `user_id`        | `UUID`        | UNIQUE, NOT NULL, FK → auth.users(id) | Reference to authenticated user         |
| `message_count`  | `INTEGER`     | NOT NULL, DEFAULT 0                  | Number of messages sent this month        |
| `month`          | `TEXT`        | NOT NULL                             | Month identifier (YYYY-MM format)         |
| `last_reset`     | `TIMESTAMPTZ` | DEFAULT now()                        | Last time quota was reset                 |
| `created_at`     | `TIMESTAMPTZ` | DEFAULT now()                        | Record creation timestamp                 |
| `updated_at`     | `TIMESTAMPTZ` | DEFAULT now()                        | Record last update timestamp              |

### Relationships:
- **Foreign Key:** `user_id` → `auth.users(id)` (ON DELETE CASCADE)

### Notes:
- Quota resets automatically when `month` changes
- `month` format: "2025-10" (YYYY-MM)
- Plan limits: Starter = 50, Professional = 200, Workshop = unlimited (-1)

---

## Message History Table

Logs all chat interactions for analytics and cost tracking.

### Table Name: `message_history`

| Column Name      | Data Type     | Constraints                          | Description                                |
|------------------|---------------|--------------------------------------|--------------------------------------------|
| `id`             | `UUID`        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique message log ID                   |
| `user_id`        | `UUID`        | NOT NULL, FK → auth.users(id)        | Reference to authenticated user            |
| `message_text`   | `TEXT`        | NOT NULL                             | User's question                            |
| `response_text`  | `TEXT`        | NOT NULL                             | AI assistant's response                    |
| `tokens_input`   | `INTEGER`     | NOT NULL                             | Input tokens consumed                      |
| `tokens_output`  | `INTEGER`     | NOT NULL                             | Output tokens consumed                     |
| `cost_gbp`       | `DECIMAL(10,4)` | NOT NULL                           | API cost in GBP (British Pounds)          |
| `created_at`     | `TIMESTAMPTZ` | DEFAULT now()                        | Message timestamp                          |

### Relationships:
- **Foreign Key:** `user_id` → `auth.users(id)` (ON DELETE CASCADE)

### Notes:
- Used for cost analysis and profit calculation
- Claude API pricing: $3/MTok input, $15/MTok output
- Cost converted to GBP at ~0.79 exchange rate
- Data retained for 12 months, then anonymised

---

## Admin Users Table

Identifies users with administrative privileges.

### Table Name: `admin_users`

| Column Name      | Data Type     | Constraints                          | Description                                |
|------------------|---------------|--------------------------------------|--------------------------------------------|
| `id`             | `UUID`        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique admin record ID                  |
| `user_id`        | `UUID`        | UNIQUE, NOT NULL, FK → auth.users(id) | Reference to authenticated user         |
| `created_at`     | `TIMESTAMPTZ` | DEFAULT now()                        | Admin role granted timestamp               |

### Relationships:
- **Foreign Key:** `user_id` → `auth.users(id)` (ON DELETE CASCADE)

### Notes:
- Presence in this table grants admin access
- Admin endpoints check for existence: `SELECT * FROM admin_users WHERE user_id = ?`
- **IMPORTANT:** First admin must be added manually via Supabase SQL editor

---

## Complete SQL Schema

### Full Database Creation Script

```sql
-- Enable UUID extension (required for UUID generation)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL,
    stripe_subscription_id TEXT NOT NULL,
    plan_id TEXT NOT NULL CHECK (plan_id IN ('starter', 'professional', 'workshop')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'canceled', 'past_due', 'trialing', 'incomplete')),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.subscriptions IS 'Stores Stripe subscription information for each user';
COMMENT ON COLUMN public.subscriptions.plan_id IS 'Subscription tier: starter, professional, or workshop';
COMMENT ON COLUMN public.subscriptions.status IS 'Stripe subscription status: active, canceled, past_due, trialing, incomplete';

-- ============================================
-- MESSAGE USAGE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.message_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
    month TEXT NOT NULL,
    last_reset TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.message_usage IS 'Tracks monthly message quota usage for each user';
COMMENT ON COLUMN public.message_usage.month IS 'Month in YYYY-MM format (e.g., 2025-10)';
COMMENT ON COLUMN public.message_usage.message_count IS 'Number of messages sent in current month';

-- ============================================
-- MESSAGE HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.message_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    response_text TEXT NOT NULL,
    tokens_input INTEGER NOT NULL CHECK (tokens_input >= 0),
    tokens_output INTEGER NOT NULL CHECK (tokens_output >= 0),
    cost_gbp DECIMAL(10,4) NOT NULL CHECK (cost_gbp >= 0),
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.message_history IS 'Logs all chat messages for analytics and cost tracking';
COMMENT ON COLUMN public.message_history.cost_gbp IS 'API cost in British Pounds (GBP)';
COMMENT ON COLUMN public.message_history.tokens_input IS 'Claude API input tokens consumed';
COMMENT ON COLUMN public.message_history.tokens_output IS 'Claude API output tokens consumed';

-- ============================================
-- ADMIN USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.admin_users IS 'Identifies users with administrative privileges';

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON public.subscriptions(stripe_subscription_id);

-- Message usage indexes
CREATE INDEX IF NOT EXISTS idx_message_usage_user_id ON public.message_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_message_usage_month ON public.message_usage(month);

-- Message history indexes
CREATE INDEX IF NOT EXISTS idx_message_history_user_id ON public.message_history(user_id);
CREATE INDEX IF NOT EXISTS idx_message_history_created_at ON public.message_history(created_at DESC);

-- Admin users index
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION (SECURE)
-- ============================================
-- Security: SET search_path prevents privilege escalation attacks
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to subscriptions table
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to message_usage table
DROP TRIGGER IF EXISTS update_message_usage_updated_at ON public.message_usage;
CREATE TRIGGER update_message_usage_updated_at
    BEFORE UPDATE ON public.message_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## Row Level Security (RLS) Policies

Supabase uses Row Level Security to control data access. **These must be configured in Supabase Dashboard or via SQL.**

### Enable RLS on All Tables

```sql
-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
```

### RLS Policies

```sql
-- ============================================
-- SUBSCRIPTIONS POLICIES
-- ============================================

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Service role (backend) can do everything
CREATE POLICY "Service role full access to subscriptions"
    ON public.subscriptions FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- MESSAGE USAGE POLICIES
-- ============================================

-- Users can view their own usage
CREATE POLICY "Users can view own usage"
    ON public.message_usage FOR SELECT
    USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access to message_usage"
    ON public.message_usage FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- MESSAGE HISTORY POLICIES
-- ============================================

-- Users can view their own message history
CREATE POLICY "Users can view own message history"
    ON public.message_history FOR SELECT
    USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access to message_history"
    ON public.message_history FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- ADMIN USERS POLICIES
-- ============================================

-- Only admins can view admin users table
CREATE POLICY "Admins can view admin users"
    ON public.admin_users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid()
        )
    );

-- Service role full access
CREATE POLICY "Service role full access to admin_users"
    ON public.admin_users FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
```

---

## Indexes and Performance

### Recommended Indexes (Already Included in Schema)

```sql
-- Subscription lookups by user
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);

-- Subscription status filtering (for admin dashboard)
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

-- Message history queries (most recent first)
CREATE INDEX idx_message_history_created_at ON public.message_history(created_at DESC);

-- Message history by user
CREATE INDEX idx_message_history_user_id ON public.message_history(user_id);

-- Usage tracking by month
CREATE INDEX idx_message_usage_month ON public.message_usage(month);
```

### Query Performance Tips

1. **Use `LIMIT`** when fetching message history (admin panel already does this)
2. **Index on `created_at DESC`** for recent message queries
3. **Composite indexes** if filtering by user + date frequently
4. **Vacuum regularly** - Supabase handles this automatically

---

## Data Retention Policies

### Recommended Retention Strategy

```sql
-- Delete message history older than 12 months (run monthly via cron)
DELETE FROM public.message_history
WHERE created_at < NOW() - INTERVAL '12 months';

-- Delete inactive subscriptions older than 90 days (after account closure)
DELETE FROM public.subscriptions
WHERE status = 'canceled'
  AND updated_at < NOW() - INTERVAL '90 days';

-- Archive old message usage records (optional - keep for analytics)
-- Consider moving to separate archive table for historical data
```

### GDPR Compliance - User Data Deletion

When a user account is deleted, **all related data is automatically deleted** due to `ON DELETE CASCADE` constraints:

```sql
-- This single command deletes the user and all related data:
DELETE FROM auth.users WHERE id = '<user_id>';

-- Cascades to:
-- - subscriptions
-- - message_usage
-- - message_history
-- - admin_users (if applicable)
```

---

## Initial Setup Instructions

### Step 1: Create Database Tables

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the **Complete SQL Schema** section above
3. Click "Run" to execute

### Step 2: Enable Row Level Security

1. Copy and paste the **RLS Policies** section
2. Click "Run" to execute

### Step 3: Add First Admin User

```sql
-- Replace 'YOUR_USER_ID' with your actual user ID from auth.users
INSERT INTO public.admin_users (user_id)
VALUES ('YOUR_USER_ID');
```

To find your user ID:
```sql
SELECT id, email FROM auth.users;
```

### Step 4: Verify Setup

```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public';
```

---

## Environment Variables Required

Ensure these are set in your `.env` file:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Get these from: **Supabase Dashboard → Settings → API**

---

## Migration Notes

### If Migrating from Existing Database

1. **Backup current data** before running schema
2. **Test in development environment** first
3. **Use transactions** to rollback if needed
4. **Check foreign key constraints** are satisfied

---

## Troubleshooting

### Common Issues

**Problem:** "relation 'uuid-ossp' does not exist"
**Solution:** Run `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

**Problem:** "permission denied for table subscriptions"
**Solution:** Ensure RLS policies are created and service role key is used in backend

**Problem:** "foreign key violation on auth.users"
**Solution:** User must exist in auth.users before inserting into related tables

---

## Schema Diagram

```
auth.users (Supabase managed)
    ↓ (user_id)
    ├── subscriptions (1:1)
    │   └── Stores Stripe subscription data
    │
    ├── message_usage (1:1)
    │   └── Tracks monthly message quotas
    │
    ├── message_history (1:many)
    │   └── Logs all chat interactions
    │
    └── admin_users (1:0..1)
        └── Grants admin privileges
```

---

## Support

For schema questions or issues:
- **Email:** support@mechanicsmate.co.uk
- **Supabase Docs:** https://supabase.com/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs/

---

*Last Updated: 18 October 2025*
*Database Version: PostgreSQL 15+ (Supabase)*
