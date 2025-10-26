const { supabaseAdmin } = require('../lib/supabase');
const { PLAN_LIMITS } = require('../lib/pricing');

// Get current month string (YYYY-MM format)
function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Check if user has quota remaining
async function checkQuota(userId, planId) {
    const currentMonth = getCurrentMonth();
    const limit = PLAN_LIMITS[planId];

    // Unlimited plan
    if (limit === -1) {
        return { allowed: true, remaining: -1, limit: -1 };
    }

    // Get or create usage record
    const { data: usage, error } = await supabaseAdmin
        .from('message_usage')
        .select('*')
        .eq('user_id', userId)
        .single();

    // No usage record exists yet
    if (error || !usage) {
        // Create new usage record
        await supabaseAdmin
            .from('message_usage')
            .insert({
                user_id: userId,
                message_count: 0,
                month: currentMonth
            });

        return {
            allowed: true,
            remaining: limit,
            limit: limit,
            used: 0
        };
    }

    // Check if month has changed (reset quota)
    if (usage.month !== currentMonth) {
        // Reset quota for new month
        await supabaseAdmin
            .from('message_usage')
            .update({
                message_count: 0,
                month: currentMonth,
                last_reset: new Date().toISOString()
            })
            .eq('user_id', userId);

        return {
            allowed: true,
            remaining: limit,
            limit: limit,
            used: 0
        };
    }

    // Check if quota exceeded
    const remaining = limit - usage.message_count;
    const allowed = remaining > 0;

    return {
        allowed,
        remaining: Math.max(0, remaining),
        limit,
        used: usage.message_count
    };
}

// Increment message count
async function incrementQuota(userId) {
    const currentMonth = getCurrentMonth();

    // Get current usage
    const { data: usage } = await supabaseAdmin
        .from('message_usage')
        .select('message_count')
        .eq('user_id', userId)
        .single();

    if (usage) {
        // Increment existing count
        await supabaseAdmin
            .from('message_usage')
            .update({
                message_count: usage.message_count + 1,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
    } else {
        // Create new usage record
        await supabaseAdmin
            .from('message_usage')
            .insert({
                user_id: userId,
                message_count: 1,
                month: currentMonth
            });
    }
}

// Log message to history (for analytics)
async function logMessage(userId, messageText, responseText, tokensInput, tokensOutput, costGBP) {
    await supabaseAdmin
        .from('message_history')
        .insert({
            user_id: userId,
            message_text: messageText,
            response_text: responseText,
            tokens_input: tokensInput,
            tokens_output: tokensOutput,
            cost_gbp: costGBP
        });
}

module.exports = {
    checkQuota,
    incrementQuota,
    logMessage
};
