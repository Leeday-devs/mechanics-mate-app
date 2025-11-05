# Database Migrations

This directory contains SQL migration files for the Mechanics Mate application database (Supabase).

## How to Apply Migrations

### Via Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **+ New query**
5. Copy the contents of the migration file you want to run
6. Paste into the SQL editor
7. Click **Run** to execute the migration

### Via Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push
```

## Migration Files

Migrations are numbered sequentially and should be run in order:

- `001_create_application_logs_table.sql` - Application logging system
- `002_fix_security_advisor_issues.sql` - Security improvements
- `003_fix_search_path_security.sql` - Search path security fixes
- `004_create_webhook_events_table.sql` - Webhook event logging
- `005_create_token_blacklist_table.sql` - Token revocation system
- `006_email_verification_system.sql` - Email verification
- `007_enable_rls_on_user_tables.sql` - Row Level Security
- `008_add_pending_status_to_subscriptions.sql` - Subscription status updates
- **`009_create_saved_conversations_table.sql`** - ⭐ NEW: Saved conversations feature

## Latest Migration (009)

**Saved Conversations Table**

This migration adds the ability for users to save their chat conversations with the AI mechanic.

### Features:
- Stores conversation messages with vehicle context
- User-specific (RLS enabled for security)
- Auto-updating timestamps
- Indexed for performance
- Plan-based limits enforced at application level

### To Apply:
Run the `009_create_saved_conversations_table.sql` file in your Supabase SQL Editor.

### Verification:
After running the migration, verify it worked:

```sql
-- Check if table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'saved_conversations';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'saved_conversations';
```

## Rolling Back

If you need to rollback the saved conversations migration:

```sql
-- Drop the table (this will delete all data!)
DROP TABLE IF EXISTS public.saved_conversations CASCADE;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_saved_conversations_updated_at() CASCADE;
```

⚠️ **Warning:** Rolling back will permanently delete all saved conversations!

## Next Steps

After applying migration 009:
1. ✅ The database table is ready
2. 📝 API endpoints for saved chats are implemented in `server.js`
3. 🎨 Dashboard UI shows saved chats count
4. 💾 Users can save and load conversations

## Support

If you encounter issues with migrations:
1. Check the Supabase logs in the Dashboard
2. Verify you have the correct database permissions
3. Ensure previous migrations were applied successfully
4. Check for any error messages in the SQL Editor
