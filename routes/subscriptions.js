const express = require('express');
const stripe = require('../lib/stripe');
const { supabaseAdmin } = require('../lib/supabase');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Plan pricing IDs from environment
const PLAN_PRICES = {
    starter: process.env.STRIPE_PRICE_STARTER,
    professional: process.env.STRIPE_PRICE_PROFESSIONAL,
    workshop: process.env.STRIPE_PRICE_WORKSHOP
};

// Create Stripe checkout session
router.post('/create-checkout', authenticateToken, async (req, res) => {
    try {
        const { planId } = req.body;
        const userId = req.user.id;
        const userEmail = req.user.email;

        if (!planId || !PLAN_PRICES[planId]) {
            return res.status(400).json({ error: 'Invalid plan selected' });
        }

        // Check if user already has active subscription
        const { data: existingSub } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();

        if (existingSub) {
            return res.status(400).json({ error: 'You already have an active subscription' });
        }

        // Create or get Stripe customer
        let customerId;
        const { data: subscription } = await supabaseAdmin
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', userId)
            .single();

        if (subscription?.stripe_customer_id) {
            customerId = subscription.stripe_customer_id;
        } else {
            const customer = await stripe.customers.create({
                email: userEmail,
                metadata: {
                    supabase_user_id: userId
                }
            });
            customerId = customer.id;
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: PLAN_PRICES[planId],
                    quantity: 1
                }
            ],
            mode: 'subscription',
            success_url: `${req.headers.origin || 'http://localhost:3000'}/dashboard?success=true`,
            cancel_url: `${req.headers.origin || 'http://localhost:3000'}/pricing?canceled=true`,
            metadata: {
                user_id: userId,
                plan_id: planId
            }
        });

        res.json({
            sessionId: session.id,
            url: session.url
        });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Error creating checkout session' });
    }
});

// Create customer portal session (for managing subscription)
router.post('/create-portal', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get customer ID
        const { data: subscription, error } = await supabaseAdmin
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', userId)
            .single();

        if (error || !subscription?.stripe_customer_id) {
            return res.status(404).json({ error: 'No subscription found' });
        }

        // Create portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripe_customer_id,
            return_url: `${req.headers.origin || 'http://localhost:3000'}/dashboard`
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Portal error:', error);
        res.status(500).json({ error: 'Error creating portal session' });
    }
});

// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionUpdate(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});

// Handle subscription creation/update
async function handleSubscriptionUpdate(subscription) {
    const customerId = subscription.customer;
    const subscriptionId = subscription.id;
    const status = subscription.status;

    // Get user ID from customer
    const customer = await stripe.customers.retrieve(customerId);
    const userId = customer.metadata.supabase_user_id;

    if (!userId) {
        console.error('No user ID found for customer:', customerId);
        return;
    }

    // Get plan ID from metadata or price
    let planId = subscription.metadata?.plan_id;
    if (!planId) {
        const priceId = subscription.items.data[0].price.id;
        planId = Object.keys(PLAN_PRICES).find(key => PLAN_PRICES[key] === priceId) || 'starter';
    }

    // Upsert subscription
    await supabaseAdmin
        .from('subscriptions')
        .upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan_id: planId,
            status: status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end
        }, {
            onConflict: 'user_id'
        });

    console.log('Subscription updated for user:', userId);
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription) {
    const subscriptionId = subscription.id;

    await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', subscriptionId);

    console.log('Subscription canceled:', subscriptionId);
}

// Handle successful payment
async function handlePaymentSucceeded(invoice) {
    const subscriptionId = invoice.subscription;

    if (subscriptionId) {
        await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'active' })
            .eq('stripe_subscription_id', subscriptionId);

        console.log('Payment succeeded for subscription:', subscriptionId);
    }
}

// Handle failed payment
async function handlePaymentFailed(invoice) {
    const subscriptionId = invoice.subscription;

    if (subscriptionId) {
        await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', subscriptionId);

        console.log('Payment failed for subscription:', subscriptionId);
    }
}

module.exports = router;
