#!/usr/bin/env node
/**
 * Script to create test accounts in Supabase for development
 *
 * Usage: node scripts/setup-test-accounts.js
 */

require('dotenv').config();
const { supabaseAdmin } = require('../lib/supabase');

const ACCOUNTS = [
    {
        email: 'leeday22@googlemail.com',
        password: 'TestPassword123',
        name: 'Lee Day 1'
    },
    {
        email: 'leedaydevs@gmail.com',
        password: 'TestPassword123',
        name: 'Lee Day 2'
    },
    {
        email: 'eltel-11@hotmail.com',
        password: 'TestPassword123',
        name: 'Lee Day 3'
    }
];

async function setupTestAccounts() {
    try {
        console.log('🔧 Setting up test accounts...\n');

        for (const account of ACCOUNTS) {
            console.log(`Creating account: ${account.email}`);

            // Try to create user
            const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
                email: account.email,
                password: account.password,
                email_confirm: true,
                user_metadata: {
                    name: account.name
                }
            });

            if (userError) {
                // If user already exists, that's fine
                if (userError.message.includes('already exists')) {
                    console.log(`  ⚠️  Account already exists`);
                } else {
                    console.log(`  ❌ Error: ${userError.message}`);
                    continue;
                }
            } else {
                console.log(`  ✅ Account created (ID: ${userData.user.id.substring(0, 8)}...)`);
            }

            // Now create a subscription for this account
            const userId = userData?.user?.id || (await getExistingUserId(account.email));

            if (userId) {
                const { data: subData, error: subError } = await supabaseAdmin
                    .from('subscriptions')
                    .insert({
                        user_id: userId,
                        status: 'active',
                        plan_id: 'professional',
                        stripe_subscription_id: `test_sub_${userId.substring(0, 8)}`,
                        stripe_customer_id: `test_cus_${userId.substring(0, 8)}`,
                        current_period_start: new Date(),
                        current_period_end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
                    })
                    .select()
                    .single();

                if (subError) {
                    if (subError.code === 'PGRST116') {
                        console.log(`  ⚠️  Subscription already exists`);
                    } else {
                        console.log(`  ⚠️  Could not create subscription: ${subError.message}`);
                    }
                } else {
                    console.log(`  ✅ Subscription created (active until ${new Date(subData.current_period_end).toLocaleDateString()})`);
                }
            }
            console.log('');
        }

        console.log('✅ Setup complete!\n');
        console.log('📝 Test accounts:');
        ACCOUNTS.forEach(acc => {
            console.log(`   Email: ${acc.email}`);
            console.log(`   Password: ${acc.password}\n`);
        });

        process.exit(0);

    } catch (error) {
        console.error('❌ Unexpected error:', error.message);
        process.exit(1);
    }
}

async function getExistingUserId(email) {
    try {
        const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) return null;

        const user = users.users.find(u => u.email === email);
        return user?.id;
    } catch (error) {
        return null;
    }
}

setupTestAccounts();
