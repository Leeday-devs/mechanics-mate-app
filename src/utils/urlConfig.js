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
    const nodeEnv = process.env.NODE_ENV;
    const siteUrl = process.env.SITE_URL;
    const appUrl = process.env.APP_URL;
    const origin = req ? (req.headers.origin || `${req.protocol}://${req.get('host')}`) : null;

    console.log('[getBaseUrl] Determining base URL:');
    console.log(`  NODE_ENV: ${nodeEnv}`);
    console.log(`  SITE_URL: ${siteUrl}`);
    console.log(`  APP_URL: ${appUrl}`);
    console.log(`  req.headers.origin: ${origin}`);

    // If we have a request with localhost in origin, use the request origin (dev environment)
    // Otherwise, prefer SITE_URL (production environment)

    // If request origin is localhost, we're in development
    if (origin && origin.includes('localhost')) {
        console.log(`[getBaseUrl] Detected localhost in origin, using it: ${origin}`);
        return origin;
    }

    // If request origin is production URL or request is from production domain
    if (origin && origin.includes('mechanics-mate.netlify.app')) {
        console.log(`[getBaseUrl] Detected production domain in origin: ${origin}`);
        return origin;
    }

    // For production (Netlify), prefer SITE_URL over APP_URL
    if (siteUrl && siteUrl.includes('netlify.app')) {
        console.log(`[getBaseUrl] Using SITE_URL (detected production): ${siteUrl}`);
        return siteUrl;
    }

    // For development, use APP_URL if available and it's localhost
    if (appUrl && appUrl.includes('localhost')) {
        console.log(`[getBaseUrl] Using APP_URL (detected development): ${appUrl}`);
        return appUrl;
    }

    // Fallback to any available origin
    if (origin) {
        console.log(`[getBaseUrl] Using request origin as fallback: ${origin}`);
        return origin;
    }

    // Final fallback
    const fallback = 'https://mechanics-mate.netlify.app';
    console.log(`[getBaseUrl] Using hardcoded fallback: ${fallback}`);
    return fallback;
}

module.exports = {
    getBaseUrl
};
