const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all users with subscription and usage data
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Get all users from Supabase Auth
        const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

        if (authError) {
            return res.status(500).json({ error: 'Error fetching users' });
        }

        // Get all subscriptions
        const { data: subscriptions } = await supabaseAdmin
            .from('subscriptions')
            .select('*');

        // Get all usage data
        const { data: usageData } = await supabaseAdmin
            .from('message_usage')
            .select('*');

        // Combine data
        const users = authUsers.users.map(user => {
            const subscription = subscriptions?.find(sub => sub.user_id === user.id);
            const usage = usageData?.find(u => u.user_id === user.id);

            return {
                id: user.id,
                email: user.email,
                created_at: user.created_at,
                last_sign_in: user.last_sign_in_at,
                subscription: subscription || null,
                usage: usage || null
            };
        });

        res.json({ users });
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// Get analytics/stats
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Count users
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
        const totalUsers = authUsers?.users?.length || 0;

        // Count active subscriptions
        const { data: activeSubscriptions } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('status', 'active');

        const totalActiveSubscriptions = activeSubscriptions?.length || 0;

        // Calculate monthly recurring revenue
        const PLAN_PRICES = {
            starter: 4.99,
            professional: 14.99,
            workshop: 39.99
        };

        let monthlyRevenue = 0;
        activeSubscriptions?.forEach(sub => {
            monthlyRevenue += PLAN_PRICES[sub.plan_id] || 0;
        });

        // Get total messages this month
        const { data: usageData } = await supabaseAdmin
            .from('message_usage')
            .select('message_count');

        const totalMessages = usageData?.reduce((sum, usage) => sum + (usage.message_count || 0), 0) || 0;

        // Get message history for cost calculation
        const { data: messageHistory } = await supabaseAdmin
            .from('message_history')
            .select('cost_gbp');

        const totalCost = messageHistory?.reduce((sum, msg) => sum + parseFloat(msg.cost_gbp || 0), 0) || 0;

        res.json({
            totalUsers,
            totalActiveSubscriptions,
            monthlyRevenue: monthlyRevenue.toFixed(2),
            totalMessages,
            totalCost: totalCost.toFixed(2),
            profit: (monthlyRevenue - totalCost).toFixed(2)
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Error fetching stats' });
    }
});

// Get recent message history
router.get('/messages', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;

        const { data: messages, error } = await supabaseAdmin
            .from('message_history')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            return res.status(500).json({ error: 'Error fetching messages' });
        }

        res.json({ messages });
    } catch (error) {
        console.error('Admin messages error:', error);
        res.status(500).json({ error: 'Error fetching messages' });
    }
});

module.exports = router;
