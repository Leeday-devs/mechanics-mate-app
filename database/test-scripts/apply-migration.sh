#!/bin/bash
# Script to apply the email verification migration

echo "📦 Applying email verification migration..."
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    echo ""
    echo "Please run:"
    echo "  npm install -g supabase"
    echo ""
    echo "Or use the Supabase Dashboard SQL Editor:"
    echo "  https://wxxedmzxwqjolbxmntaq.supabase.co/project/wxxedmzxwqjolbxmntaq/sql"
    echo ""
    echo "Then paste the contents of: database/migrations/006_email_verification_system.sql"
    exit 1
fi

# Apply the migration using supabase CLI
echo "🔄 Running migration..."
supabase db push --db-url "postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" --file database/migrations/006_email_verification_system.sql

echo "✅ Migration complete!"
