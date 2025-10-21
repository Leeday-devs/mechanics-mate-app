const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../lib/supabase');

// Middleware to verify JWT token
async function authenticateToken(req, res, next) {
    try {
        // Get token from Authorization header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from Supabase
        const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(decoded.userId);

        if (error || !user) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // Attach user to request
        req.user = {
            id: user.user.id,
            email: user.user.email
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

// Middleware to check if user has an active subscription
async function requireSubscription(req, res, next) {
    try {
        const userId = req.user.id;

        // Get user's subscription (accept active, trialing, or incomplete)
        const { data: subscription, error } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .in('status', ['active', 'trialing', 'incomplete'])
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
