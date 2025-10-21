// Test script for existing customers with various subscription statuses
const { supabaseAdmin } = require('./lib/supabase');

async function checkExistingSubscriptions() {
    console.log('🔍 Checking Existing Customer Subscriptions\n');
    console.log('=' .repeat(50));

    try {
        // Get all subscriptions
        const { data: subscriptions, error } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Error fetching subscriptions:', error);
            return;
        }

        if (!subscriptions || subscriptions.length === 0) {
            console.log('⚠️  No subscriptions found in database');
            return;
        }

        console.log(`📊 Found ${subscriptions.length} subscription(s)\n`);

        subscriptions.forEach((sub, index) => {
            console.log(`\n${index + 1}. Subscription Details:`);
            console.log('   User ID:', sub.user_id);
            console.log('   Plan:', sub.plan_id);
            console.log('   Status:', sub.status);
            console.log('   Stripe Customer:', sub.stripe_customer_id);
            console.log('   Stripe Subscription:', sub.stripe_subscription_id);
            console.log('   Period End:', new Date(sub.current_period_end).toLocaleString());
            console.log('   Created:', new Date(sub.created_at).toLocaleString());

            // Check if status is valid
            const validStatuses = ['active', 'trialing', 'incomplete'];
            if (validStatuses.includes(sub.status)) {
                console.log('   ✅ Status is valid - user can access dashboard');
            } else {
                console.log('   ⚠️  Status not valid - user cannot access dashboard');
                console.log('      (Status needs to be: active, trialing, or incomplete)');
            }
        });

        // Count by status
        console.log('\n' + '='.repeat(50));
        console.log('\n📈 Subscription Status Summary:');
        const statusCounts = {};
        subscriptions.forEach(sub => {
            statusCounts[sub.status] = (statusCounts[sub.status] || 0) + 1;
        });

        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   ${status}: ${count}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    }

    console.log('\n' + '='.repeat(50));
}

checkExistingSubscriptions();
