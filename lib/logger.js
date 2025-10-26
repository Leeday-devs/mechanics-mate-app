/**
 * Comprehensive Logging Utility
 *
 * Logs all important events to the application_logs table in Supabase
 * Helps with debugging, monitoring, and compliance
 */

const { supabaseAdmin } = require('./supabase');

class Logger {
    constructor() {
        this.logBuffer = []; // Buffer logs for batch inserts
        this.flushInterval = 5000; // Flush every 5 seconds
        this.startFlushTimer();
    }

    /**
     * Main logging function
     */
    async log({
        userId,
        logType,
        severity = 'info',
        title,
        message,
        endpoint,
        method,
        statusCode,
        ipAddress,
        userAgent,
        metadata = {},
        errorStack,
        durationMs
    }) {
        try {
            const logEntry = {
                user_id: userId || null,
                log_type: logType,
                severity: severity,
                title: title,
                message: message || null,
                endpoint: endpoint || null,
                method: method || null,
                status_code: statusCode || null,
                ip_address: ipAddress || null,
                user_agent: userAgent || null,
                metadata: metadata,
                error_stack: errorStack || null,
                duration_ms: durationMs || null,
                created_at: new Date().toISOString()
            };

            // Add to buffer
            this.logBuffer.push(logEntry);

            // Flush if buffer is large
            if (this.logBuffer.length >= 10) {
                await this.flush();
            }

            // Also log to console in development
            if (process.env.NODE_ENV === 'development') {
                this.logToConsole(logEntry);
            }
        } catch (error) {
            console.error('Logger error:', error);
        }
    }

    /**
     * Log login event
     */
    async logLogin({
        userId,
        email,
        success = true,
        ipAddress,
        userAgent,
        reason = null
    }) {
        await this.log({
            userId,
            logType: 'login',
            severity: success ? 'info' : 'warning',
            title: success ? 'User Login' : 'Failed Login Attempt',
            message: success ? `User ${email} logged in` : `Failed login for ${email}: ${reason}`,
            statusCode: success ? 200 : 401,
            ipAddress,
            userAgent,
            metadata: {
                email,
                reason
            }
        });
    }

    /**
     * Log logout event
     */
    async logLogout({ userId, email, ipAddress, userAgent }) {
        await this.log({
            userId,
            logType: 'logout',
            severity: 'info',
            title: 'User Logout',
            message: `User ${email} logged out`,
            statusCode: 200,
            ipAddress,
            userAgent,
            metadata: { email }
        });
    }

    /**
     * Log API call
     */
    async logApiCall({
        userId,
        endpoint,
        method,
        statusCode,
        durationMs,
        ipAddress,
        userAgent,
        message,
        metadata = {}
    }) {
        await this.log({
            userId,
            logType: 'api_call',
            severity: statusCode >= 400 ? 'warning' : 'info',
            title: `${method} ${endpoint}`,
            message: message || `API call to ${endpoint}`,
            endpoint,
            method,
            statusCode,
            durationMs,
            ipAddress,
            userAgent,
            metadata: {
                ...metadata,
                status: statusCode >= 400 ? 'failed' : 'success'
            }
        });
    }

    /**
     * Log error
     */
    async logError({
        userId,
        title,
        message,
        error,
        endpoint,
        method,
        statusCode = 500,
        ipAddress,
        userAgent,
        metadata = {}
    }) {
        await this.log({
            userId,
            logType: 'error',
            severity: 'error',
            title: title || 'Application Error',
            message: message || error?.message,
            endpoint,
            method,
            statusCode,
            ipAddress,
            userAgent,
            errorStack: error?.stack,
            metadata: {
                ...metadata,
                errorName: error?.name,
                errorMessage: error?.message
            }
        });
    }

    /**
     * Log critical error
     */
    async logCritical({
        userId,
        title,
        message,
        error,
        endpoint,
        metadata = {}
    }) {
        await this.log({
            userId,
            logType: 'error',
            severity: 'critical',
            title: title || 'CRITICAL ERROR',
            message: message || error?.message,
            endpoint,
            errorStack: error?.stack,
            metadata: {
                ...metadata,
                requiresImmediateAction: true
            }
        });
    }

    /**
     * Log payment event
     */
    async logPayment({
        userId,
        eventType, // 'checkout_created', 'payment_succeeded', 'payment_failed', 'subscription_created'
        stripePlan,
        amount,
        success,
        message,
        metadata = {}
    }) {
        await this.log({
            userId,
            logType: 'payment',
            severity: success ? 'info' : 'error',
            title: `Payment: ${eventType}`,
            message: message,
            statusCode: success ? 200 : 400,
            metadata: {
                ...metadata,
                eventType,
                stripePlan,
                amount,
                success
            }
        });
    }

    /**
     * Log chat message
     */
    async logChat({
        userId,
        messageLength,
        tokensUsed,
        costGBP,
        success,
        message
    }) {
        await this.log({
            userId,
            logType: 'chat',
            severity: success ? 'info' : 'warning',
            title: success ? 'Chat Message Sent' : 'Chat Message Failed',
            message: message,
            statusCode: success ? 200 : 500,
            metadata: {
                messageLength,
                tokensUsed,
                costGBP,
                success
            }
        });
    }

    /**
     * Log admin action
     */
    async logAdminAction({
        userId,
        action,
        targetUserId,
        details,
        metadata = {}
    }) {
        await this.log({
            userId,
            logType: 'admin_action',
            severity: 'info',
            title: `Admin Action: ${action}`,
            message: `Admin performed: ${action}${targetUserId ? ` on user ${targetUserId}` : ''}`,
            metadata: {
                ...metadata,
                action,
                targetUserId,
                details
            }
        });
    }

    /**
     * Log subscription change
     */
    async logSubscription({
        userId,
        eventType, // 'created', 'updated', 'canceled'
        planId,
        status,
        message
    }) {
        await this.log({
            userId,
            logType: 'subscription',
            severity: 'info',
            title: `Subscription: ${eventType}`,
            message: message || `Subscription ${eventType}: ${planId}`,
            metadata: {
                eventType,
                planId,
                status
            }
        });
    }

    /**
     * Log security event
     */
    async logSecurity({
        userId,
        eventType, // 'suspicious_activity', 'failed_auth', 'rate_limit'
        severity,
        message,
        metadata = {}
    }) {
        await this.log({
            userId,
            logType: 'security',
            severity: severity || 'warning',
            title: `Security: ${eventType}`,
            message,
            metadata: {
                ...metadata,
                eventType
            }
        });
    }

    /**
     * Flush buffered logs to database
     */
    async flush() {
        if (this.logBuffer.length === 0) {
            return;
        }

        try {
            const logsToInsert = [...this.logBuffer];
            this.logBuffer = [];

            const { error } = await supabaseAdmin
                .from('application_logs')
                .insert(logsToInsert);

            if (error) {
                console.error('Error flushing logs to database:', error);
                // Try to put them back in the buffer
                this.logBuffer.unshift(...logsToInsert);
            }
        } catch (error) {
            console.error('Flush error:', error);
        }
    }

    /**
     * Log to console (development only)
     */
    logToConsole(logEntry) {
        const { log_type, severity, title, message } = logEntry;
        const prefix = `[${log_type.toUpperCase()}:${severity.toUpperCase()}]`;

        if (severity === 'error' || severity === 'critical') {
            console.error(`${prefix} ${title}:`, message);
        } else if (severity === 'warning') {
            console.warn(`${prefix} ${title}:`, message);
        } else {
            console.log(`${prefix} ${title}:`, message);
        }
    }

    /**
     * Start periodic flush timer
     */
    startFlushTimer() {
        this.flushTimer = setInterval(() => {
            this.flush().catch(error => {
                console.error('Periodic flush error:', error);
            });
        }, this.flushInterval);
    }

    /**
     * Stop flush timer (graceful shutdown)
     */
    stopFlushTimer() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
    }

    /**
     * Force immediate flush
     */
    async forceFlush() {
        await this.flush();
    }
}

// Create singleton instance
const logger = new Logger();

// Graceful shutdown
process.on('SIGTERM', async () => {
    await logger.forceFlush();
    logger.stopFlushTimer();
});

module.exports = logger;
