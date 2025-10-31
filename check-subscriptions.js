// Quick script to check subscriptions in Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    try {
        console.log('Fetching all subscriptions...\n');

        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error fetching subscriptions:', error);
            return;
        }

        if (!data || data.length === 0) {
            console.log('No subscriptions found');
            return;
        }

        console.log(`Found ${data.length} subscriptions:\n`);

        data.forEach((sub, i) => {
            console.log(`${i + 1}. Subscription ID: ${sub.id}`);
            console.log(`   User ID: ${sub.user_id}`);
            console.log(`   Stripe Customer ID: ${sub.stripe_customer_id}`);
            console.log(`   Stripe Subscription ID: ${sub.stripe_subscription_id}`);
            console.log(`   Plan ID: ${sub.plan_id}`);
            console.log(`   Status: ${sub.status}`);
            console.log(`   Created: ${sub.created_at}`);
            console.log(`   Updated: ${sub.updated_at}`);
            console.log('');
        });
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

main();
