const crypto = require('crypto');
const { supabaseAdmin } = require('../lib/supabase');

/**
 * Generate a secure email verification token
 * @returns {string} A secure random token
 */
function generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Create an email verification token for a user
 * @param {string} userId - The Supabase user ID
 * @param {string} email - The user's email address
 * @returns {Promise<string>} The verification token
 */
async function createVerificationToken(userId, email) {
    const token = generateVerificationToken();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    try {
        await supabaseAdmin
            .from('email_verification_tokens')
            .insert({
                user_id: userId,
                email,
                token,
                token_expires_at: tokenExpiresAt.toISOString()
            });

        return token;
    } catch (error) {
        console.error('Failed to create verification token:', error);
        throw new Error('Failed to create verification token');
    }
}

/**
 * Verify an email verification token
 * @param {string} token - The verification token to check
 * @returns {Promise<Object>} The verification record if valid
 */
async function verifyEmailToken(token) {
    try {
        const { data, error } = await supabaseAdmin
            .from('email_verification_tokens')
            .select('*')
            .eq('token', token)
            .gt('token_expires_at', new Date().toISOString())
            .single();

        if (error || !data) {
            return null;
        }

        return data;
    } catch (error) {
        console.error('Failed to verify email token:', error);
        return null;
    }
}

/**
 * Mark an email as verified
 * @param {string} token - The verification token
 * @returns {Promise<boolean>} Success status
 */
async function markEmailAsVerified(token) {
    try {
        // Get the verification record
        const verification = await verifyEmailToken(token);
        if (!verification) {
            return false;
        }

        // Update the verification token record
        await supabaseAdmin
            .from('email_verification_tokens')
            .update({ verified_at: new Date().toISOString() })
            .eq('token', token);

        // Mark user as email verified (Note: This assumes auth.users table is accessible)
        // If not accessible, you can skip this or handle it differently
        try {
            await supabaseAdmin.auth.admin.updateUserById(verification.user_id, {
                user_metadata: {
                    email_verified: true
                }
            });
        } catch (err) {
            console.warn('Could not update user metadata:', err.message);
        }

        return true;
    } catch (error) {
        console.error('Failed to mark email as verified:', error);
        return false;
    }
}

/**
 * Generate a verification link for email
 * @param {string} token - The verification token
 * @param {string} baseUrl - The base URL of your application
 * @returns {string} The full verification link
 */
function generateVerificationLink(token, baseUrl) {
    return `${baseUrl}/verify-email?token=${token}`;
}

/**
 * Check if a user's email is verified
 * @param {string} userId - The Supabase user ID
 * @returns {Promise<boolean>} Whether email is verified
 */
async function isEmailVerified(userId) {
    try {
        const { data: user } = await supabaseAdmin.auth.admin.getUserById(userId);
        return user?.user?.user_metadata?.email_verified === true;
    } catch (error) {
        console.error('Failed to check email verification status:', error);
        return false;
    }
}

/**
 * Clean up expired verification tokens
 * @returns {Promise<number>} Number of deleted tokens
 */
async function cleanupExpiredTokens() {
    try {
        const { count, error } = await supabaseAdmin
            .from('email_verification_tokens')
            .delete()
            .lt('token_expires_at', new Date().toISOString());

        if (error) {
            console.error('Failed to cleanup expired tokens:', error);
            return 0;
        }

        return count || 0;
    } catch (error) {
        console.error('Unexpected error during token cleanup:', error);
        return 0;
    }
}

module.exports = {
    generateVerificationToken,
    createVerificationToken,
    verifyEmailToken,
    markEmailAsVerified,
    generateVerificationLink,
    isEmailVerified,
    cleanupExpiredTokens
};
