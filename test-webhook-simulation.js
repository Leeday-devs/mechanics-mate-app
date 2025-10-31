// Simulate a Stripe webhook to test the webhook handler
const crypto = require('crypto');
const stripe = require('./src/lib/stripe');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function simulateWebhook() {
    try {
        console.log('========================================');
        console.log('Simulating Stripe Webhook');
        console.log('========================================\n');

        // Get the latest pending subscription
        const { data: pendingSubs, error: fetchError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);

        if (fetchError || !pendingSubs || pendingSubs.length === 0) {
            console.error('No pending subscriptions found');
            return;
        }

        const pendingSub = pendingSubs[0];
        console.log('Found pending subscription:');
        console.log('  ID:', pendingSub.id);
        console.log('  User ID:', pendingSub.user_id);
        console.log('  Customer ID:', pendingSub.stripe_customer_id);
        console.log('  Plan ID:', pendingSub.plan_id);
        console.log('');

        // Retrieve the customer from Stripe to make sure it exists
        console.log('Verifying customer exists in Stripe...');
        const customer = await stripe.customers.retrieve(pendingSub.stripe_customer_id);
        console.log('✓ Customer found:', customer.id);
        console.log('');

        // Create a real Stripe subscription
        console.log('Creating actual Stripe subscription...');
        const subscription = await stripe.subscriptions.create({
            customer: pendingSub.stripe_customer_id,
            items: [{
                price: process.env.STRIPE_PRICE_STARTER,
            }],
            metadata: {
                plan_id: pendingSub.plan_id,
                supabase_user_id: pendingSub.user_id
            },
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent'],
        });

        console.log('✓ Stripe subscription created:', subscription.id);
        console.log('  Status:', subscription.status);
        try {
            console.log('  Period Start:', new Date(subscription.current_period_start * 1000).toISOString());
            console.log('  Period End:', new Date(subscription.current_period_end * 1000).toISOString());
        } catch (e) {
            console.log('  Period Start:', subscription.current_period_start);
            console.log('  Period End:', subscription.current_period_end);
        }
        console.log('');

        // Now simulate the webhook event
        console.log('Simulating webhook event (customer.subscription.updated)...');
        const event = {
            id: 'evt_' + crypto.randomBytes(16).toString('hex'),
            type: 'customer.subscription.updated',
            created: Math.floor(Date.now() / 1000),
            data: {
                object: subscription
            }
        };

        console.log('Event ID:', event.id);
        console.log('Event Type:', event.type);
        console.log('');

        // Sign the webhook
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = stripe.webhooks.generateTestHeaderString({
            payload: JSON.stringify(event),
            secret: stripeWebhookSecret,
        });

        console.log('Generated webhook signature');
        console.log('');

        // POST the webhook to our endpoint
        console.log('Sending webhook to local server...');
        const response = await fetch('http://localhost:3000/api/subscriptions/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'stripe-signature': signature,
            },
            body: JSON.stringify(event),
        });

        const result = await response.json();
        console.log('Webhook response:', result);
        console.log('');

        // Check if the subscription was updated
        console.log('Checking if subscription was updated in Supabase...');
        const { data: updatedSub, error: updateError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('id', pendingSub.id)
            .single();

        if (updateError) {
            console.error('Error fetching updated subscription:', updateError);
            return;
        }

        console.log('Updated subscription:');
        console.log('  Stripe Subscription ID:', updatedSub.stripe_subscription_id);
        console.log('  Status:', updatedSub.status);
        console.log('  Period Start:', updatedSub.current_period_start);
        console.log('  Period End:', updatedSub.current_period_end);
        console.log('');

        if (updatedSub.stripe_subscription_id === subscription.id && updatedSub.status === subscription.status) {
            console.log('========================================');
            console.log('✓ WEBHOOK SIMULATION SUCCESSFUL');
            console.log('========================================');
            console.log('The subscription was properly updated from pending to', subscription.status);
        } else {
            console.log('========================================');
            console.log('✗ WEBHOOK SIMULATION FAILED');
            console.log('========================================');
            console.log('Expected stripe_subscription_id:', subscription.id);
            console.log('Got stripe_subscription_id:', updatedSub.stripe_subscription_id);
            console.log('Expected status:', subscription.status);
            console.log('Got status:', updatedSub.status);
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response);
        }
    }
}

simulateWebhook();
