const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../lib/supabase');

// Middleware to verify JWT token
async function authenticateToken(req, res, next) {
    console.error('🚨 AUTH MIDDLEWARE CALLED - Auth header:', req.headers['authorization']?.substring(0, 20));
    try {
        // Get token from Authorization header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔐 Token verified for user:', decoded.email);

        // ============================================
        // CHECK TOKEN BLACKLIST
        // ============================================
        // Ensure token hasn't been blacklisted (e.g., user logged out)
        try {
            const { data: blacklistedToken } = await supabaseAdmin
                .from('token_blacklist')
                .select('id')
                .eq('token_jti', decoded.jti || token.substring(0, 50)) // Use jti or first 50 chars of token
                .single();

            if (blacklistedToken) {
                console.warn(`⚠️  Attempt to use blacklisted token for user: ${decoded.email}`);
                return res.status(401).json({
                    error: 'Token has been revoked',
                    code: 'TOKEN_REVOKED'
                });
            }
        } catch (error) {
            // If token_blacklist table doesn't exist yet, log but continue
            if (error.code !== 'PGRST116') { // "not found" error code
                console.warn('⚠️  Could not check token blacklist:', error.message);
            }
        }

        // Get user from Supabase
        console.log('📍 Looking up user in Supabase:', decoded.userId);
        const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(decoded.userId);

        if (error) {
            console.error('❌ Supabase error looking up user:', error);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        if (!user || !user.user) {
            console.error('❌ User not found in Supabase:', user);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // Attach user to request
        req.user = {
            id: user.user.id,
            email: user.user.email
        };
        req.token = token; // Attach token for logout blacklisting

        console.log('✅ Auth successful for user:', req.user.email);
        next();
    } catch (error) {
        console.error('❌ Auth middleware error:', error.message);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

// Middleware to check if user has an active subscription
async function requireSubscription(req, res, next) {
    try {
        const userId = req.user.id;

        // Get user's subscription (accept pending, active, trialing, or incomplete)
        // pending = subscription record created during checkout, waiting for webhook
        // active = subscription confirmed by webhook
        // trialing = free trial
        // incomplete = payment in progress
        const { data: subscription, error } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .in('status', ['pending', 'active', 'trialing', 'incomplete'])
            .single();

        if (error || !subscription) {
            return res.status(403).json({
                error: 'Active subscription required',
                needsSubscription: true
            });
        }

        // Attach subscription to request
        req.subscription = subscription;
        next();
    } catch (error) {
        console.error('Subscription middleware error:', error);
        return res.status(500).json({ error: 'Error checking subscription' });
    }
}

// Middleware to check if user is an admin
async function requireAdmin(req, res, next) {
    try {
        const userId = req.user.id;

        // Check if user is in admin_users table
        const { data: admin, error } = await supabaseAdmin
            .from('admin_users')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        req.admin = admin;
        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        return res.status(500).json({ error: 'Error checking admin status' });
    }
}

module.exports = {
    authenticateToken,
    requireSubscription,
    requireAdmin
};
