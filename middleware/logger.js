/**
 * Logging Middleware
 *
 * Automatically logs all API calls, errors, and important events
 */

const logger = require('../lib/logger');

/**
 * Middleware to log all API calls
 * Measures duration and tracks success/failure
 */
function requestLoggingMiddleware(req, res, next) {
    const startTime = Date.now();

    // Get client IP address
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    // Wrap response.send to capture status code
    const originalSend = res.send;
    res.send = function(data) {
        const durationMs = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Don't log webhook endpoints (too many/sensitive)
        if (!req.path.includes('webhook')) {
            // Log to database asynchronously (don't block response)
            logger.logApiCall({
                userId: req.user?.id || null,
                endpoint: req.path,
                method: req.method,
                statusCode: statusCode,
                durationMs: durationMs,
                ipAddress: ipAddress,
                userAgent: userAgent,
                metadata: {
                    query: req.query,
                    bodySize: JSON.stringify(req.body || {}).length
                }
            }).catch(error => {
                console.error('Failed to log API call:', error);
            });
        }

        return originalSend.call(this, data);
    };

    next();
}

/**
 * Middleware to log errors
 * Should be added as the last middleware
 */
function errorLoggingMiddleware(err, req, res, next) {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    // Determine severity based on status code
    let severity = 'error';
    if (err.statusCode >= 500) {
        severity = 'critical';
    }

    // Log the error to database asynchronously
    logger.logError({
        userId: req.user?.id || null,
        title: `${req.method} ${req.path} - ${err.statusCode || 500}`,
        message: err.message,
        error: err,
        endpoint: req.path,
        method: req.method,
        statusCode: err.statusCode || 500,
        ipAddress: ipAddress,
        userAgent: userAgent,
        metadata: {
            query: req.query,
            originalUrl: req.originalUrl
        }
    }).catch(error => {
        console.error('Failed to log error:', error);
    });

    // Continue to error handler
    next(err);
}

/**
 * Middleware to detect and log suspicious activity
 * (Rate limiting, unusual patterns, etc)
 */
function securityLoggingMiddleware(req, res, next) {
    // Check for suspicious patterns
    if (req.path.includes('eval') ||
        req.path.includes('exec') ||
        req.path.includes('script') ||
        req.body && JSON.stringify(req.body).includes('script')) {

        logger.logSecurity({
            userId: req.user?.id || null,
            eventType: 'suspicious_activity',
            severity: 'warning',
            message: `Suspicious activity detected on ${req.method} ${req.path}`,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            }
        }).catch(error => {
            console.error('Failed to log security event:', error);
        });
    }

    next();
}

module.exports = {
    requestLoggingMiddleware,
    errorLoggingMiddleware,
    securityLoggingMiddleware
};
