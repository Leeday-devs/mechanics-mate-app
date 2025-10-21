const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { supabase, supabaseAdmin } = require('../lib/supabase');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Rate limiter for authentication endpoints - prevent brute force attacks
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        error: 'Too many authentication attempts. Please try again in 15 minutes.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for successful requests (only count failures)
    skipSuccessfulRequests: true
});

// Sign up with email/password
router.post('/signup', authLimiter, async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name || ''
                }
            }
        });

        if (authError) {
            console.error('Signup error:', authError);
            return res.status(400).json({ error: authError.message });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: authData.user.id, email: authData.user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: authData.user.id,
                email: authData.user.email,
                name: authData.user.user_metadata?.name || ''
            },
            message: 'Account created successfully. Please check your email to verify your account.'
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Error creating account' });
    }
});

// Login with email/password
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Sign in with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            console.error('Login error:', authError);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: authData.user.id, email: authData.user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Get subscription status (accept active, trialing, or incomplete)
        const { data: subscription } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', authData.user.id)
            .in('status', ['active', 'trialing', 'incomplete'])
            .single();

        res.json({
            success: true,
            token,
            user: {
                id: authData.user.id,
                email: authData.user.email,
                name: authData.user.user_metadata?.name || ''
            },
            hasSubscription: !!subscription,
            subscription: subscription || null
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error logging in' });
    }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get subscription (accept active, trialing, or incomplete statuses)
        const { data: subscription } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .in('status', ['active', 'trialing', 'incomplete'])
            .single();

        // Get usage stats
        const { data: usage } = await supabaseAdmin
            .from('message_usage')
            .select('*')
            .eq('user_id', userId)
            .single();

        // Check if admin
        const { data: admin } = await supabaseAdmin
            .from('admin_users')
            .select('*')
            .eq('user_id', userId)
            .single();

        res.json({
            user: req.user,
            subscription: subscription || null,
            usage: usage || { message_count: 0, month: new Date().toISOString().slice(0, 7) },
            isAdmin: !!admin
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Error fetching user data' });
    }
});

// Logout (client-side will remove token)
router.post('/logout', authenticateToken, async (req, res) => {
    // Supabase signOut
    await supabase.auth.signOut();
    res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
