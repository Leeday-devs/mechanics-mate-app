const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');
const { SAVED_CHATS_LIMITS } = require('../lib/pricing');
const logger = require('../lib/logger');

/**
 * GET /api/conversations/saved
 * Get all saved conversations for the authenticated user
 */
router.get('/saved', async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: conversations, error } = await supabaseAdmin
            .from('saved_conversations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('[Conversations] Error fetching saved conversations:', error);
            return res.status(500).json({ error: 'Failed to fetch saved conversations' });
        }

        return res.json({
            success: true,
            conversations: conversations || []
        });

    } catch (error) {
        logger.error('[Conversations] Error in GET /saved:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/conversations/save
 * Save a new conversation
 */
router.post('/save', async (req, res) => {
    try {
        const userId = req.user.id;
        const subscription = req.subscription;
        const { title, vehicle, messages } = req.body;

        // Validate required fields
        if (!title || !messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Title and messages are required' });
        }

        // Check saved chats limit for user's plan
        const planId = subscription.plan_id;
        const savedChatsLimit = SAVED_CHATS_LIMITS[planId] || 0;

        if (savedChatsLimit === 0) {
            return res.status(403).json({
                error: 'Your plan does not include saved conversations',
                needsUpgrade: true,
                currentPlan: planId
            });
        }

        // Count existing saved conversations
        const { count, error: countError } = await supabaseAdmin
            .from('saved_conversations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (countError) {
            logger.error('[Conversations] Error counting conversations:', countError);
            return res.status(500).json({ error: 'Failed to check conversation limit' });
        }

        // Check if user has reached their limit
        if (count >= savedChatsLimit) {
            return res.status(403).json({
                error: `You have reached your limit of ${savedChatsLimit} saved conversations`,
                needsUpgrade: true,
                currentLimit: savedChatsLimit,
                currentCount: count
            });
        }

        // Save the conversation
        const { data: savedConversation, error: saveError } = await supabaseAdmin
            .from('saved_conversations')
            .insert({
                user_id: userId,
                title: title.trim(),
                vehicle_year: vehicle?.year || null,
                vehicle_make: vehicle?.make || null,
                vehicle_model: vehicle?.model || null,
                vehicle_engine_type: vehicle?.engineType || null,
                vehicle_engine_size: vehicle?.engineSize || null,
                messages: JSON.stringify(messages)
            })
            .select()
            .single();

        if (saveError) {
            logger.error('[Conversations] Error saving conversation:', saveError);
            return res.status(500).json({ error: 'Failed to save conversation' });
        }

        logger.info(`[Conversations] User ${userId} saved conversation: ${savedConversation.id}`);

        return res.json({
            success: true,
            conversation: savedConversation,
            message: 'Conversation saved successfully'
        });

    } catch (error) {
        logger.error('[Conversations] Error in POST /save:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/conversations/:id
 * Get a specific saved conversation
 */
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = req.params.id;

        const { data: conversation, error } = await supabaseAdmin
            .from('saved_conversations')
            .select('*')
            .eq('id', conversationId)
            .eq('user_id', userId)
            .single();

        if (error || !conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        return res.json({
            success: true,
            conversation
        });

    } catch (error) {
        logger.error('[Conversations] Error in GET /:id:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/conversations/:id
 * Update a saved conversation (e.g., change title)
 */
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = req.params.id;
        const { title } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // Update the conversation
        const { data: updatedConversation, error } = await supabaseAdmin
            .from('saved_conversations')
            .update({
                title: title.trim()
            })
            .eq('id', conversationId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error || !updatedConversation) {
            return res.status(404).json({ error: 'Conversation not found or update failed' });
        }

        logger.info(`[Conversations] User ${userId} updated conversation: ${conversationId}`);

        return res.json({
            success: true,
            conversation: updatedConversation,
            message: 'Conversation updated successfully'
        });

    } catch (error) {
        logger.error('[Conversations] Error in PUT /:id:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/conversations/:id
 * Delete a saved conversation
 */
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = req.params.id;

        const { error } = await supabaseAdmin
            .from('saved_conversations')
            .delete()
            .eq('id', conversationId)
            .eq('user_id', userId);

        if (error) {
            logger.error('[Conversations] Error deleting conversation:', error);
            return res.status(500).json({ error: 'Failed to delete conversation' });
        }

        logger.info(`[Conversations] User ${userId} deleted conversation: ${conversationId}`);

        return res.json({
            success: true,
            message: 'Conversation deleted successfully'
        });

    } catch (error) {
        logger.error('[Conversations] Error in DELETE /:id:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
