const express = require('express');
const stripe = require('../lib/stripe');
const { supabaseAdmin } = require('../lib/supabase');
const { authenticateToken } = require('../middleware/auth');
const { PLAN_PRICES } = require('../lib/pricing');
const logger = require('../lib/logger');

const router = express.Router();

// ============================================
// CHECK SUBSCRIPTION STATUS (for loading page)
// ============================================
// Get current subscription status - used while loading after payment
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user's subscription (include 'pending' status which is set during checkout)
        const { data: subscriptions, error } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .in('status', ['pending', 'active', 'trialing', 'incomplete']);

        if (error || !subscriptions || subscriptions.length === 0) {
            return res.status(404).json({
                error: 'No subscription found',
                subscription: null
            });
        }

        // Return the first subscription (most recent)
        const subscription = subscriptions[0];

        res.json({
            subscription: {
                id: subscription.id,
                plan_id: subscription.plan_id,
                status: subscription.status,
                current_period_start: subscription.current_period_start,
                current_period_end: subscription.current_period_end
            }
        });
    } catch (error) {
        console.error('Subscription status check error:', error);
        res.status(500).json({ error: 'Error checking subscription' });
    }
});

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
        let subscriptionId;
        const { data: existingSubscription } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .not('status', 'eq', 'canceled');

        if (existingSubscription && existingSubscription.length > 0) {
            // Use existing subscription record
            customerId = existingSubscription[0].stripe_customer_id;
            subscriptionId = existingSubscription[0].id;
        } else {
            // Create new Stripe customer
            const customer = await stripe.customers.create({
                email: userEmail,
                metadata: {
                    supabase_user_id: userId
                }
            });
            customerId = customer.id;

            // Create subscription record with 'pending' status
            // This ensures the subscription exists while waiting for webhook
            console.log('[Checkout] Creating subscription record:', { userId, customerId, planId });

            const { data: newSub, error: subError } = await supabaseAdmin
                .from('subscriptions')
                .insert({
                    user_id: userId,
                    stripe_customer_id: customerId,
                    plan_id: planId,
                    status: 'pending' // Temporary status until webhook confirms
                })
                .select()
                .single();

            if (subError) {
                console.error('[Checkout] Failed to create subscription:', subError);
                throw new Error(`Failed to create subscription record: ${subError.message}`);
            }

            if (newSub) {
                console.log('[Checkout] Subscription created successfully:', newSub.id);
                subscriptionId = newSub.id;
            } else {
                console.error('[Checkout] Subscription insert returned no data');
                throw new Error('Subscription record was not created');
            }
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
            success_url: `${req.headers.origin || 'http://localhost:3000'}/loading.html?success=true`,
            cancel_url: `${req.headers.origin || 'http://localhost:3000'}/pricing.html?canceled=true`,
            metadata: {
                user_id: userId,
                plan_id: planId
            }
        });

        // Log checkout session creation
        logger.logPayment({
            userId,
            eventType: 'checkout_session_created',
            stripePlan: planId,
            amount: 'pending',
            success: true,
            message: `Checkout session created for plan: ${planId}`
        }).catch(err => console.error('Failed to log payment:', err));

        res.json({
            sessionId: session.id,
            url: session.url
        });
    } catch (error) {
        console.error('Checkout error:', error);

        // Log checkout error
        logger.logPayment({
            userId,
            eventType: 'checkout_session_failed',
            stripePlan: planId,
            amount: '0',
            success: false,
            message: error.message
        }).catch(err => console.error('Failed to log payment error:', err));

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
            return_url: `${req.headers.origin || 'http://localhost:3000'}/dashboard.html`
        });

        // Log portal session creation
        logger.logPayment({
            userId,
            eventType: 'portal_session_created',
            stripePlan: subscription.plan_id || 'unknown',
            amount: '0',
            success: true,
            message: 'Billing portal session created'
        }).catch(err => console.error('Failed to log portal session:', err));

        res.json({ url: session.url });
    } catch (error) {
        console.error('Portal error:', error);

        // Log portal error
        logger.logPayment({
            userId,
            eventType: 'portal_session_failed',
            stripePlan: 'unknown',
            amount: '0',
            success: false,
            message: error.message
        }).catch(err => console.error('Failed to log portal error:', err));

        res.status(500).json({ error: 'Error creating portal session' });
    }
});

// Stripe webhook handler with idempotency
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

    // ============================================
    // WEBHOOK IDEMPOTENCY CHECK
    // ============================================
    // Check if this event has already been processed
    try {
        const { data: existingEvent } = await supabaseAdmin
            .from('webhook_events')
            .select('id')
            .eq('event_id', event.id)
            .single();

        if (existingEvent) {
            console.log(`⚠️  Duplicate webhook event detected: ${event.id} (${event.type}). Ignoring.`);
            return res.json({ received: true, duplicate: true });
        }
    } catch (error) {
        // If the table doesn't exist or query fails, log but continue
        console.warn('⚠️  Could not check webhook idempotency:', error.message);
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

        // ============================================
        // RECORD SUCCESSFUL EVENT PROCESSING
        // ============================================
        // Store the event as processed for idempotency
        try {
            await supabaseAdmin
                .from('webhook_events')
                .insert({
                    event_id: event.id,
                    event_type: event.type,
                    data: event,
                    status: 'processed'
                });
        } catch (error) {
            console.error('Failed to record webhook event:', error.message);
            // Don't fail the webhook if we can't record it, but log the error
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook handler error:', error);

        // ============================================
        // RECORD FAILED EVENT PROCESSING
        // ============================================
        // Store the event as failed for debugging
        try {
            await supabaseAdmin
                .from('webhook_events')
                .insert({
                    event_id: event.id,
                    event_type: event.type,
                    data: event,
                    status: 'failed'
                });
        } catch (dbError) {
            console.error('Failed to record webhook error:', dbError.message);
        }

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
        logger.logError({
            title: 'Subscription Update Error',
            message: `No user ID found for customer: ${customerId}`,
            endpoint: '/api/subscriptions/webhook',
            method: 'POST',
            statusCode: 500,
            metadata: { subscriptionId, customerId }
        }).catch(err => console.error('Failed to log error:', err));
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

    // Log subscription update
    logger.logSubscription({
        userId,
        eventType: 'subscription_updated',
        planId,
        status,
        message: `Subscription updated to ${status} for plan: ${planId}`
    }).catch(err => console.error('Failed to log subscription update:', err));

    console.log('Subscription updated for user:', userId);
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription) {
    const subscriptionId = subscription.id;

    await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', subscriptionId);

    // Get user ID for logging
    const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscriptionId)
        .single();

    if (sub) {
        logger.logSubscription({
            userId: sub.user_id,
            eventType: 'subscription_deleted',
            planId: 'unknown',
            status: 'canceled',
            message: `Subscription canceled: ${subscriptionId}`
        }).catch(err => console.error('Failed to log subscription deletion:', err));
    }

    console.log('Subscription canceled:', subscriptionId);
}

// Handle successful payment
async function handlePaymentSucceeded(invoice) {
    const subscriptionId = invoice.subscription;

    if (subscriptionId) {
        // Get subscription to find user and plan
        const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('stripe_subscription_id', subscriptionId)
            .single();

        await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'active' })
            .eq('stripe_subscription_id', subscriptionId);

        // Log payment success
        if (sub) {
            logger.logPayment({
                userId: sub.user_id,
                eventType: 'payment_succeeded',
                stripePlan: sub.plan_id,
                amount: (invoice.amount_paid / 100).toFixed(2),
                success: true,
                message: `Payment succeeded for subscription: ${subscriptionId}`
            }).catch(err => console.error('Failed to log payment success:', err));
        }

        console.log('Payment succeeded for subscription:', subscriptionId);
    }
}

// Handle failed payment
async function handlePaymentFailed(invoice) {
    const subscriptionId = invoice.subscription;

    if (subscriptionId) {
        // Get subscription to find user and plan
        const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('stripe_subscription_id', subscriptionId)
            .single();

        await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', subscriptionId);

        // Log payment failure
        if (sub) {
            logger.logPayment({
                userId: sub.user_id,
                eventType: 'payment_failed',
                stripePlan: sub.plan_id,
                amount: (invoice.amount_due / 100).toFixed(2),
                success: false,
                message: `Payment failed for subscription: ${subscriptionId}. Error: ${invoice.last_payment_error?.message || 'Unknown'}`
            }).catch(err => console.error('Failed to log payment failure:', err));
        }

        console.log('Payment failed for subscription:', subscriptionId);
    }
}

module.exports = router;
