/**
 * Utility to determine the correct base URL for the application
 * Handles both development and production environments
 */

/**
 * Get the correct base URL for generating email verification links and redirects
 * @param {Object} req - Express request object (optional)
 * @returns {string} The base URL to use for generating links
 */
function getBaseUrl(req) {
    // In production (Netlify), use SITE_URL
    if (process.env.NODE_ENV === 'production' && process.env.SITE_URL) {
        return process.env.SITE_URL;
    }

    // In development, use APP_URL
    if (process.env.APP_URL) {
        return process.env.APP_URL;
    }

    // Fallback to request headers (for dynamic environments)
    if (req) {
        const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
        return origin;
    }

    // Final fallback
    return process.env.SITE_URL || 'https://mechanics-mate.netlify.app';
}

module.exports = {
    getBaseUrl
};
