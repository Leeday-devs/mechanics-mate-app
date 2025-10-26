/**
 * Logs API Routes
 *
 * Admin endpoints for viewing application logs
 * Helps with debugging and monitoring
 */

const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const logger = require('../lib/logger');

const router = express.Router();

/**
 * Get all application logs (paginated, with filters)
 * GET /api/logs?type=error&severity=critical&limit=50&page=1&userId=xxx&startDate=2025-10-25&endDate=2025-10-26
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Validate and constrain pagination
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const offset = (page - 1) * limit;

        // Build query
        let query = supabaseAdmin
            .from('application_logs')
            .select('*', { count: 'exact' });

        // Apply filters
        if (req.query.type) {
            query = query.eq('log_type', req.query.type);
        }

        if (req.query.severity) {
            query = query.eq('severity', req.query.severity);
        }

        if (req.query.userId) {
            query = query.eq('user_id', req.query.userId);
        }

        if (req.query.endpoint) {
            query = query.ilike('endpoint', `%${req.query.endpoint}%`);
        }

        if (req.query.statusCode) {
            query = query.eq('status_code', parseInt(req.query.statusCode));
        }

        // Date range filtering
        if (req.query.startDate) {
            query = query.gte('created_at', req.query.startDate);
        }

        if (req.query.endDate) {
            query = query.lte('created_at', req.query.endDate);
        }

        // Search in title or message
        if (req.query.search) {
            query = query.or(`title.ilike.%${req.query.search}%,message.ilike.%${req.query.search}%`);
        }

        // Order and paginate
        const { data: logs, count, error } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            throw error;
        }

        res.json({
            logs,
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Get logs error:', error);
        logger.logError({
            userId: req.user.id,
            title: 'Failed to fetch logs',
            message: error.message,
            error,
            endpoint: '/api/logs',
            method: 'GET',
            statusCode: 500
        }).catch(() => {});

        res.status(500).json({ error: 'Error fetching logs' });
    }
});

/**
 * Get logs for a specific user
 * GET /api/logs/user/:userId
 */
router.get('/user/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const offset = (page - 1) * limit;

        const { data: logs, count, error } = await supabaseAdmin
            .from('application_logs')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            throw error;
        }

        res.json({
            userId,
            logs,
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Get user logs error:', error);
        res.status(500).json({ error: 'Error fetching user logs' });
    }
});

/**
 * Get log statistics/summary
 * GET /api/logs/stats/summary
 */
router.get('/stats/summary', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

        // Get error count
        const { count: errorCount } = await supabaseAdmin
            .from('application_logs')
            .select('*', { count: 'exact' })
            .gte('created_at', startTime)
            .in('severity', ['error', 'critical']);

        // Get critical errors
        const { count: criticalCount } = await supabaseAdmin
            .from('application_logs')
            .select('*', { count: 'exact' })
            .gte('created_at', startTime)
            .eq('severity', 'critical');

        // Get login count
        const { count: loginCount } = await supabaseAdmin
            .from('application_logs')
            .select('*', { count: 'exact' })
            .gte('created_at', startTime)
            .eq('log_type', 'login');

        // Get failed login count
        const { count: failedLoginCount } = await supabaseAdmin
            .from('application_logs')
            .select('*', { count: 'exact' })
            .gte('created_at', startTime)
            .eq('log_type', 'login')
            .eq('status_code', 401);

        // Get average API response time
        const { data: apiLogs } = await supabaseAdmin
            .from('application_logs')
            .select('duration_ms')
            .gte('created_at', startTime)
            .eq('log_type', 'api_call')
            .not('duration_ms', 'is', null);

        const avgResponseTime = apiLogs && apiLogs.length > 0
            ? Math.round(apiLogs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / apiLogs.length)
            : 0;

        res.json({
            timeRange: {
                hours,
                since: startTime
            },
            summary: {
                totalErrors: errorCount || 0,
                criticalErrors: criticalCount || 0,
                totalLogins: loginCount || 0,
                failedLogins: failedLoginCount || 0,
                avgResponseTimeMs: avgResponseTime
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Error fetching statistics' });
    }
});

/**
 * Get logs grouped by type
 * GET /api/logs/stats/by-type
 */
router.get('/stats/by-type', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

        const { data: logs, error } = await supabaseAdmin
            .from('application_logs')
            .select('log_type')
            .gte('created_at', startTime);

        if (error) {
            throw error;
        }

        // Count by type
        const countByType = {};
        logs.forEach(log => {
            countByType[log.log_type] = (countByType[log.log_type] || 0) + 1;
        });

        res.json({
            timeRange: { hours, since: startTime },
            byType: countByType
        });
    } catch (error) {
        console.error('Get logs by type error:', error);
        res.status(500).json({ error: 'Error fetching logs by type' });
    }
});

/**
 * Get logs grouped by severity
 * GET /api/logs/stats/by-severity
 */
router.get('/stats/by-severity', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

        const { data: logs, error } = await supabaseAdmin
            .from('application_logs')
            .select('severity')
            .gte('created_at', startTime);

        if (error) {
            throw error;
        }

        // Count by severity
        const countBySeverity = {};
        logs.forEach(log => {
            countBySeverity[log.severity] = (countBySeverity[log.severity] || 0) + 1;
        });

        res.json({
            timeRange: { hours, since: startTime },
            bySeverity: countBySeverity
        });
    } catch (error) {
        console.error('Get logs by severity error:', error);
        res.status(500).json({ error: 'Error fetching logs by severity' });
    }
});

/**
 * Get most recent errors
 * GET /api/logs/recent-errors
 */
router.get('/recent-errors', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

        const { data: errors, error } = await supabaseAdmin
            .from('application_logs')
            .select('*')
            .in('severity', ['error', 'critical'])
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw error;
        }

        res.json({ errors });
    } catch (error) {
        console.error('Get recent errors error:', error);
        res.status(500).json({ error: 'Error fetching recent errors' });
    }
});

/**
 * Delete old logs (cleanup)
 * DELETE /api/logs/cleanup
 * Admin only
 */
router.delete('/cleanup', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 90;
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const { count, error } = await supabaseAdmin
            .from('application_logs')
            .delete()
            .lt('created_at', cutoffDate)
            .not('severity', 'eq', 'critical');

        if (error) {
            throw error;
        }

        logger.logAdminAction({
            userId: req.user.id,
            action: 'cleanup_logs',
            details: `Deleted logs older than ${days} days`
        }).catch(() => {});

        res.json({
            message: `Deleted ${count} logs older than ${days} days`,
            deletedCount: count
        });
    } catch (error) {
        console.error('Cleanup logs error:', error);
        res.status(500).json({ error: 'Error cleaning up logs' });
    }
});

module.exports = router;
