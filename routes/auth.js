const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const csrf = require('csurf');
const { supabase, supabaseAdmin } = require('../lib/supabase');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../lib/logger');
const emailVerification = require('../utils/emailVerification');

const router = express.Router();

// ============================================
// CSRF PROTECTION
// ============================================
// CSRF protection middleware - use double-submit cookie pattern
const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'lax'
    }
});

// ============================================
// INPUT VALIDATION RULES
// ============================================
const signupValidation = [
    body('email')
        .isEmail()
        .trim()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters'),
    body('name')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Name must be less than 100 characters')
];

const loginValidation = [
    body('email')
        .isEmail()
        .trim()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

// Validation error handler middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

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

// Get CSRF token endpoint - clients call this to get a token before signup/login
router.get('/csrf-token', csrfProtection, (req, res) => {
    // Return CSRF token to client
    res.json({
        csrfToken: req.csrfToken()
    });
});

// Sign up with email/password
router.post('/signup', csrfProtection, authLimiter, signupValidation, handleValidationErrors, async (req, res) => {
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
router.post('/login', csrfProtection, authLimiter, loginValidation, handleValidationErrors, async (req, res) => {
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

            // Log failed login attempt
            logger.logLogin({
                email,
                success: false,
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                reason: 'Invalid credentials'
            }).catch(err => console.error('Failed to log login:', err));

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

        // Log successful login (asynchronously, don't block response)
        logger.logLogin({
            userId: authData.user.id,
            email: authData.user.email,
            success: true,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        }).catch(err => console.error('Failed to log login:', err));

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

        // Log error
        logger.logError({
            title: 'Login Error',
            message: error.message,
            error,
            endpoint: '/api/auth/login',
            method: 'POST',
            statusCode: 500,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        }).catch(err => console.error('Failed to log error:', err));

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
router.post('/logout', csrfProtection, authenticateToken, async (req, res) => {
    try {
        // Supabase signOut
        await supabase.auth.signOut();

        // ============================================
        // ADD TOKEN TO BLACKLIST
        // ============================================
        // Blacklist the token to prevent reuse
        if (req.token) {
            try {
                const decodedToken = jwt.decode(req.token);
                const expiresAt = decodedToken?.exp
                    ? new Date(decodedToken.exp * 1000)
                    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

                await supabaseAdmin
                    .from('token_blacklist')
                    .insert({
                        token_jti: decodedToken?.jti || req.token.substring(0, 50),
                        user_id: req.user.id,
                        email: req.user.email,
                        expires_at: expiresAt.toISOString(),
                        reason: 'logout'
                    });

                console.log(`✅ Token blacklisted for user: ${req.user.email}`);
            } catch (error) {
                console.error('Failed to blacklist token:', error.message);
                // Don't fail logout if blacklist fails, but log the error
            }
        }

        // Log logout event
        logger.logLogout({
            userId: req.user.id,
            email: req.user.email,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        }).catch(err => console.error('Failed to log logout:', err));

        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        logger.logError({
            userId: req.user.id,
            title: 'Logout Error',
            message: error.message,
            error,
            endpoint: '/api/auth/logout',
            method: 'POST'
        }).catch(err => console.error('Failed to log error:', err));

        res.status(500).json({ error: 'Error logging out' });
    }
});

// ============================================
// EMAIL VERIFICATION
// ============================================

// Verify email with token from email link
router.post('/verify-email', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Verification token required' });
        }

        // Verify the token
        const verification = await emailVerification.verifyEmailToken(token);
        if (!verification) {
            return res.status(400).json({
                error: 'Invalid or expired verification token',
                code: 'TOKEN_EXPIRED'
            });
        }

        // Mark email as verified
        const success = await emailVerification.markEmailAsVerified(token);
        if (!success) {
            return res.status(500).json({ error: 'Failed to verify email' });
        }

        // Log email verification
        logger.logPayment({
            userId: verification.user_id,
            eventType: 'email_verified',
            stripePlan: 'n/a',
            amount: '0',
            success: true,
            message: `Email verified: ${verification.email}`
        }).catch(err => console.error('Failed to log email verification:', err));

        res.json({
            success: true,
            message: 'Email verified successfully',
            email: verification.email
        });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ error: 'Error verifying email' });
    }
});

// Resend verification email (authenticated users only)
router.post('/resend-verification', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userEmail = req.user.email;

        // Create new verification token
        const token = await emailVerification.createVerificationToken(userId, userEmail);

        // Generate verification link
        const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
        const verificationLink = emailVerification.generateVerificationLink(token, baseUrl);

        // In a real application, you would send an email here
        // For now, we'll return the link (in production, use a proper email service like SendGrid)
        console.log(`📧 Verification link for ${userEmail}: ${verificationLink}`);

        res.json({
            success: true,
            message: 'Verification email sent',
            // In production, remove this line and actually send the email
            verificationLink: process.env.NODE_ENV === 'development' ? verificationLink : undefined
        });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: 'Failed to send verification email' });
    }
});

// CSRF error handler middleware
router.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        // Handle CSRF token errors
        console.warn('⚠️  CSRF token validation failed:', {
            path: req.path,
            method: req.method,
            ip: req.ip
        });
        res.status(403).json({
            error: 'Invalid or missing CSRF token',
            code: 'CSRF_TOKEN_INVALID'
        });
    } else {
        // Pass other errors to the next handler
        next(err);
    }
});

module.exports = router;
