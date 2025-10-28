require('dotenv').config({ path: '/home/lddevs/mechanics-mate-app/.env' });
const { supabaseAdmin } = require('/home/lddevs/mechanics-mate-app/lib/supabase');

async function checkSubscriptions() {
    try {
        console.log('Fetching users and subscriptions...\n');

        // Get all users
        const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();

        if (userError) {
            console.error('Error fetching users:', userError);
            process.exit(1);
        }

        console.log(`Found ${users.users.length} users:\n`);

        for (const user of users.users) {
            const userIdShort = user.id.substring(0, 8);
            console.log(`User: ${user.email} (ID: ${userIdShort}...)`);

            // Check for subscriptions
            const { data: subs, error: subError } = await supabaseAdmin
                .from('subscriptions')
                .select('*')
                .eq('user_id', user.id);

            if (subError) {
                console.log(`  Error: ${subError.message}`);
                continue;
            }

            if (subs && subs.length > 0) {
                subs.forEach(sub => {
                    const startDate = new Date(sub.current_period_start).toLocaleDateString();
                    const endDate = new Date(sub.current_period_end).toLocaleDateString();
                    console.log(`  ✓ Subscription: ${sub.status} (plan: ${sub.plan_id})`);
                    console.log(`    Period: ${startDate} - ${endDate}`);
                });
            } else {
                console.log(`  ✗ No subscriptions found`);
            }
            console.log('');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkSubscriptions();
