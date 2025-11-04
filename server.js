const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const FirecrawlApp = require('@mendable/firecrawl-js').default;

// Load .env file ONLY if it exists AND we're in development
// In production (Railway), environment variables come from the container/dashboard
const envPath = path.join(__dirname, '.env');
const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
const envFileExists = fs.existsSync(envPath);

if (isDev && envFileExists) {
    require('dotenv').config();
    console.log('📝 Loaded .env file for development');
} else if (isDev) {
    console.log('⚠️  No .env file found, using environment variables only');
} else {
    console.log('🚀 Production mode - using container environment variables');
}

// ============================================
// SENTRY ERROR TRACKING (Production Only)
// ============================================
const Sentry = require("@sentry/node");
const { CaptureConsole } = require("@sentry/integrations");

if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT || 'production',
        integrations: [
            new CaptureConsole({
                levels: ['error', 'warn']
            })
        ],
        tracesSampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '0.1'),
        beforeSend(event, hint) {
            if (event.exception) {
                const error = hint.originalException;
                console.error('🔴 Sentry capturing error:', error.message);
            }
            return event;
        }
    });
    console.log('✅ Sentry error tracking initialized');
}

// ============================================
// ENVIRONMENT VALIDATION
// ============================================
// CRITICAL variables that MUST be set (without these, auth/payments won't work)
const criticalEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'JWT_SECRET'
];

// OPTIONAL variables that enhance functionality but aren't required for basic operation
const optionalEnvVars = [
    'ANTHROPIC_API_KEY'
];

const allEnvVars = [...criticalEnvVars, ...optionalEnvVars];

// Debug: Log what variables we actually have
console.log('🔍 Checking environment variables...');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
allEnvVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅' : '❌';
    const display = value ? value.substring(0, 20) + '...' : 'MISSING';
    const isOptional = optionalEnvVars.includes(varName) ? ' (optional)' : '';
    console.log(`   ${status} ${varName}${isOptional}: ${display}`);
});

// Check for MISSING CRITICAL variables (will cause crash)
const missingCriticalVars = criticalEnvVars.filter(varName => !process.env[varName]);
if (missingCriticalVars.length > 0) {
    console.error('\n❌ CRITICAL: Missing REQUIRED environment variables:');
    missingCriticalVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\n⚠️  Server startup blocked - these variables are essential!');
    console.error('\nPlease check your .env file or environment variables are set.');
    process.exit(1);
}

// Check for MISSING OPTIONAL variables (will warn but continue)
const missingOptionalVars = optionalEnvVars.filter(varName => !process.env[varName]);
if (missingOptionalVars.length > 0) {
    console.warn('\n⚠️  WARNING: Missing optional environment variables:');
    missingOptionalVars.forEach(varName => console.warn(`   - ${varName} (features using this will be disabled)`));
    console.warn('\nServer will start but some features may not work properly.\n');
}

console.log('✅ All critical environment variables are set - server ready to start!\n');

// CRITICAL: Warn if using live Stripe keys in development
if (process.env.NODE_ENV !== 'production' && process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════╗');
    console.error('║  🚨 CRITICAL SECURITY ISSUE: LIVE STRIPE KEYS IN DEV MODE! 🚨  ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('  ❌ NODE_ENV = development');
    console.error('  ❌ STRIPE_SECRET_KEY starts with sk_live_');
    console.error('');
    console.error('  RISK: Real charges will be processed during testing!');
    console.error('');
    console.error('  ACTION REQUIRED:');
    console.error('  1. Stop the server NOW');
    console.error('  2. Read: STRIPE_KEYS_SETUP.md');
    console.error('  3. Get TEST keys from Stripe Dashboard (Test Mode ON)');
    console.error('  4. Update .env with TEST keys (sk_test_... format)');
    console.error('  5. Restart server');
    console.error('');
    console.error('  NEVER use sk_live_ keys outside production!');
    console.error('');
    console.error('  Reference: https://stripe.com/docs/testing');
    console.error('');
    process.exit(1);  // Force shutdown
}

// CRITICAL: Also check publishable key for live mode in development
if (process.env.NODE_ENV !== 'production' && process.env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_live_')) {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════╗');
    console.error('║  🚨 CRITICAL SECURITY ISSUE: LIVE STRIPE KEYS IN DEV MODE! 🚨  ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('  ❌ NODE_ENV = development');
    console.error('  ❌ STRIPE_PUBLISHABLE_KEY starts with pk_live_');
    console.error('');
    console.error('  RISK: Real charges will be processed during testing!');
    console.error('');
    console.error('  ACTION REQUIRED: See STRIPE_KEYS_SETUP.md');
    console.error('');
    process.exit(1);
}

// Check for duplicate price IDs
const priceIds = [
    process.env.STRIPE_PRICE_STARTER,
    process.env.STRIPE_PRICE_PROFESSIONAL,
    process.env.STRIPE_PRICE_WORKSHOP
];
const uniquePriceIds = new Set(priceIds);
if (uniquePriceIds.size !== priceIds.length) {
    console.warn('⚠️  WARNING: Duplicate Stripe price IDs detected!');
    console.warn('   STARTER:', process.env.STRIPE_PRICE_STARTER);
    console.warn('   PROFESSIONAL:', process.env.STRIPE_PRICE_PROFESSIONAL);
    console.warn('   WORKSHOP:', process.env.STRIPE_PRICE_WORKSHOP);
}

console.log('✅ Environment validation passed');

// Import routes and middleware
const authRoutes = require('./src/routes/auth');
const subscriptionRoutes = require('./src/routes/subscriptions');
const adminRoutes = require('./src/routes/admin');
const logsRoutes = require('./src/routes/logs');
const { authenticateToken, requireSubscription } = require('./src/middleware/auth');
const { requestLoggingMiddleware, errorLoggingMiddleware, securityLoggingMiddleware } = require('./src/middleware/logger');
const { checkQuota, incrementQuota, logMessage } = require('./src/utils/quota');
const logger = require('./src/lib/logger');
const { supabaseAdmin } = require('./src/lib/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting - prevents API abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 chat requests per minute
    message: {
        error: 'Too many chat requests. Please wait a moment before sending another message.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// CORS Configuration - Secure by default
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

// Security headers with Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // Required for inline scripts
            connectSrc: ["'self'", "https://api.anthropic.com", "https://*.supabase.co", "https://api.stripe.com"]
        }
    }
}));

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn('⚠️  CORS blocked request from:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Attach Sentry request handler (must be first error handler)
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.requestHandler());
}

// Stripe webhook needs raw body - must come before express.json()
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(cookieParser()); // Parse cookies for CSRF token validation
app.use('/api/', apiLimiter); // Apply rate limiting to all API endpoints

// Logging middleware - logs all API calls and security events
app.use('/api/', securityLoggingMiddleware); // Detect suspicious activity
app.use('/api/', requestLoggingMiddleware); // Log all API calls

// HTML Page Routes - MUST be defined BEFORE static middleware
// Landing page at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/landing.html'));
});

// Chat interface (previously index.html)
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/logs', logsRoutes); // Comprehensive logging endpoints

// Serve static files AFTER route handlers to prevent index.html from overriding root
app.use(express.static('./public', { index: false })); // Serve from public directory
app.use(express.static('.', { index: false })); // Also serve root level for backwards compatibility

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Validation middleware helper
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: errors.array()[0].msg,
            details: errors.array()
        });
    }
    next();
};

// Helper function to add timeout to promises
function withTimeout(promise, timeoutMs, timeoutMessage = 'Operation timed out') {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        )
    ]);
}

// Function to search UK automotive forums for relevant information using Firecrawl
// TEMPORARILY DISABLED: Causing 504 timeouts on Netlify
async function searchForums(vehicleInfo, userQuestion) {
    // Skip forum search to prevent 504 errors
    // TODO: Re-enable after implementing async background job or caching
    console.log('ℹ️ Forum search temporarily disabled to prevent timeouts');
    return null;
}

// Chat endpoint - now requires authentication and active subscription
app.post(
    '/api/chat',
    chatLimiter,
    authenticateToken,
    requireSubscription,
    [
        body('message')
            .trim()
            .notEmpty().withMessage('Message is required')
            .isString().withMessage('Message must be a string')
            .isLength({ max: 5000 }).withMessage('Message is too long. Maximum length is 5000 characters.'),
        body('conversationHistory')
            .optional()
            .isArray().withMessage('Conversation history must be an array')
            .custom(arr => arr.length <= 12).withMessage('Conversation history is too long. Please start a new conversation.')
    ],
    validateRequest,
    async (req, res) => {
    try {
        const { message, conversationHistory = [] } = req.body;
        const userId = req.user.id;
        const subscription = req.subscription;

        // Check message quota
        const quotaCheck = await checkQuota(userId, subscription.plan_id);
        if (!quotaCheck.allowed) {
            return res.status(429).json({
                error: 'Monthly message quota exceeded',
                quota: {
                    limit: quotaCheck.limit,
                    used: quotaCheck.used,
                    remaining: 0
                },
                needsUpgrade: true
            });
        }

        // Build messages array for Claude - limit to last 6 messages (3 exchanges) for optimal performance
        const recentHistory = conversationHistory.slice(-6);
        const messages = [
            ...recentHistory,
            {
                role: 'user',
                content: message
            }
        ];

        // Extract vehicle information from message
        let vehicleInfo = '';
        const vehicleMatch = message.match(/\[Vehicle: ([^\]]+)\]/);
        if (vehicleMatch) {
            vehicleInfo = vehicleMatch[1];
        }

        // Remove vehicle prefix from message for cleaner search
        const cleanMessage = message.replace(/\[Vehicle: [^\]]+\]\s*/, '');

        // Search forums for relevant discussions
        const forumResults = await searchForums(vehicleInfo, cleanMessage);

        // Build forum context for AI
        let forumContext = '';
        if (forumResults && forumResults.length > 0) {
            forumContext = '\n\nRECENT FORUM DISCUSSIONS:\n';
            forumResults.forEach((result, index) => {
                forumContext += `${index + 1}. ${result.title}\n   ${result.snippet}\n   Source: ${result.link}\n\n`;
            });
        }

        // System prompt to make Claude act as a UK-based car mechanic expert
        const systemPrompt = `You are My Mechanic, a UK-based expert automotive assistant with access to extensive automotive knowledge and UK repair forums.

========================================
VEHICLE INFORMATION (CRITICAL):
${vehicleInfo ? `🚗 USER'S VEHICLE: ${vehicleInfo}

⚠️ MANDATORY: You MUST acknowledge this specific vehicle at the start of EVERY response and tailor ALL advice specifically to this exact make, model, year, and engine. DO NOT give generic advice - be vehicle-specific!` : '⚠️ No specific vehicle provided - ask the user to select their vehicle from the dropdowns for personalized advice.'}
${forumContext}
========================================

UK-SPECIFIC REQUIREMENTS:
- Use UK terminology (tyre not tire, bonnet not hood, boot not trunk, windscreen not windshield, petrol not gas)
- ALL COST ESTIMATES AND PRICES MUST BE IN BRITISH POUNDS (£) - NEVER USE DOLLARS ($)
- Reference UK MOT requirements and standards
- Provide service intervals in miles (UK uses miles, not kilometres)
- Reference UK automotive regulations and road laws
- Use metric measurements for specifications (litres, millimetres, kilograms)
- Consider right-hand drive (RHD) vehicle configurations
- Reference UK-specific vehicle variants and trim levels

YOUR PROCESS:
1. ⚠️ FIRST: If vehicle info is provided, START your response by explicitly mentioning the specific vehicle (e.g., "For your 2018 Ford Focus 1.5L Petrol...")
2. ANALYZE the user's question carefully, considering the specific vehicle information provided
3. REVIEW the recent UK forum discussions provided above (if any) for real-world experiences
4. SEARCH your knowledge base for UK-specific information about THIS EXACT VEHICLE
5. CROSS-REFERENCE common issues, recalls, and DVSA safety recalls specific to THIS VEHICLE
6. VERIFY your answer by considering:
   - Recent UK forum discussions and real user experiences for THIS SPECIFIC MODEL
   - Official service manuals and UK specifications for THIS VEHICLE
   - Common reported issues for THIS EXACT MODEL on UK automotive forums
   - Manufacturer recommendations for UK market for THIS VEHICLE
   - UK MOT requirements and safety considerations for THIS MODEL
7. CITE sources when referencing forum discussions
8. PROVIDE a verified, accurate answer with UK-specific references TAILORED TO THE EXACT VEHICLE

YOUR CAPABILITIES:
- Car repair and maintenance questions for UK vehicles
- MOT preparation and requirements
- Step-by-step troubleshooting guides specific to UK vehicle variants
- Understanding car problems and symptoms
- Explaining how different car systems work
- Providing safety tips and best practices
- Reference to common UK forum discussions and known issues

ANSWER FORMAT (MANDATORY - MUST FOLLOW THIS STRUCTURE):

⚠️ CRITICAL: Your responses MUST be well-formatted and easy to read. Use this structure:

1. **START WITH VEHICLE ACKNOWLEDGMENT**
   - Begin with: "For Your [Year Make Model Engine] - [Issue Title]"
   - Example: "For Your 2014 Ford Focus 1.0L Petrol - Knocking Noise Diagnosis"

2. **OPENING SUMMARY** (2-3 sentences max)
   - Brief overview of the issue
   - Quick context about why this matters

3. **USE CLEAR SECTION HEADERS WITH EMOJIS**
   - ⚠️ CRITICAL ISSUE or 🔧 DIAGNOSIS or 📋 WHAT TO CHECK or ✅ RECOMMENDATIONS
   - Keep headers short and scannable
   - Add a blank line before and after each section

4. **FORMAT LISTS AS BULLET POINTS**
   - Use bullet points (•, -, or *) for ALL lists
   - ONE item per line
   - Keep each point concise (1-2 sentences max)
   - Group related items under subheadings
   - Example:
     **Common Causes:**
     • Overheating and pre-detonation
     • Worn timing components
     • Low oil level or pressure

5. **FORMAT PROCEDURES AS NUMBERED STEPS**
   - Use numbered lists (1., 2., 3.) for sequential instructions
   - ONE action per step
   - Keep steps clear and actionable
   - Example:
     **Immediate Actions:**
     1. Check oil level immediately
     2. Stop driving if knocking persists
     3. Book diagnostic at Ford specialist

6. **USE BOLD FOR KEY POINTS**
   - **Bold** important warnings, costs, or critical information
   - Example: **DO NOT DRIVE** or **Cost: £800-1,400**

7. **KEEP PARAGRAPHS SHORT**
   - Maximum 2-3 sentences per paragraph
   - Add blank line between paragraphs
   - Avoid walls of text

8. **INCLUDE A "MY RECOMMENDATION" SECTION AT THE END**
   - Clear, actionable next steps
   - Use bullet points
   - Prioritize by urgency

9. **FORMATTING RULES:**
   - NO walls of text - break into sections
   - Use blank lines to separate sections
   - Use emojis sparingly for visual breaks (⚠️, 🔧, ✅, 📋, 💰, 🚗)
   - Keep technical jargon to minimum or explain it
   - Write like you're talking to a customer, not another mechanic

EXAMPLE STRUCTURE:
========================================
For Your 2014 Ford Focus 1.0L Petrol - Engine Knocking Diagnosis

Your 1.0L EcoBoost has a known issue with engine knocking. This needs immediate attention as it can cause serious damage.

⚠️ CRITICAL - EcoBoost-Specific Issue

Your engine has a known problem with:
• Overheating and pre-detonation
• Coolant system failures
• Worn timing components

🔧 Common Knocking Causes

**Engine Bay Issues:**
• Low oil level or pressure
• Worn timing belt/chain
• Failing water pump

**Symptoms to Watch:**
• Knocking when engine is warm
• Worse under acceleration
• Warning lights on dashboard

✅ My Recommendations

**Immediate Actions:**
1. Check oil level NOW
2. Stop driving if knocking persists
3. Book diagnostic at Ford specialist

**Expected Costs:**
• Diagnostic: £80-150
• Wet belt replacement: **£800-1,400**
• Oil change: £60-100

This is a serious issue - don't delay getting it checked!
========================================

USE THIS FORMAT FOR EVERY RESPONSE. Keep it clean, scannable, and customer-friendly!

IMPORTANT SAFETY RULES:
- If a repair is dangerous or requires special tools, recommend professional help from a UK garage
- Always mention safety precautions (axle stands, eye protection, etc.)
- Warn about potential risks (fire, injury, vehicle damage)
- For electrical or fuel system work, emphasise disconnecting the battery
- Never recommend shortcuts that compromise safety
- Reference UK health and safety guidelines

Be thorough, accurate, and always prioritise the user's safety. When in doubt, recommend consulting a qualified UK mechanic or approved dealer.`;

        // Call Claude API (no timeout - let Netlify's 10s limit handle it)
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 4096, // Increased for more detailed responses
            system: systemPrompt,
            messages: messages
        });

        // Extract the response text
        const assistantMessage = response.content[0].text;

        // Increment quota and log message (don't await to avoid blocking response)
        incrementQuota(userId).catch(err => console.error('Error incrementing quota:', err));

        // Calculate cost (Claude 3.5 Sonnet pricing: $3/MTok input, $15/MTok output)
        const inputTokens = response.usage.input_tokens;
        const outputTokens = response.usage.output_tokens;
        const costGBP = ((inputTokens * 3 / 1000000) + (outputTokens * 15 / 1000000)) * 0.79; // Convert USD to GBP

        logMessage(userId, message, assistantMessage, inputTokens, outputTokens, costGBP)
            .catch(err => console.error('Error logging message:', err));

        // Log successful chat
        logger.logChat({
            userId,
            messageLength: message.length,
            tokensUsed: inputTokens + outputTokens,
            costGBP: parseFloat(costGBP.toFixed(2)),
            success: true,
            message: `Chat message processed (${inputTokens} input + ${outputTokens} output tokens)`
        }).catch(err => console.error('Failed to log chat:', err));

        // Build updated conversation history (keep only last 6 messages for optimal performance)
        const updatedHistory = [
            ...messages,
            {
                role: 'assistant',
                content: assistantMessage
            }
        ].slice(-6); // Keep only last 6 messages (3 exchanges)

        res.json({
            response: assistantMessage,
            conversationHistory: updatedHistory,
            quota: {
                remaining: quotaCheck.remaining - 1,
                limit: quotaCheck.limit,
                used: quotaCheck.used + 1
            }
        });

    } catch (error) {
        console.error('Error calling Claude API:', error);

        // Log chat error
        logger.logChat({
            userId: req.user?.id,
            messageLength: req.body?.message?.length || 0,
            tokensUsed: 0,
            costGBP: 0,
            success: false,
            message: error.message || 'Claude API error'
        }).catch(err => console.error('Failed to log chat error:', err));

        res.status(500).json({
            error: 'Failed to get response from AI assistant. Please try again.',
            errorCode: 'CLAUDE_API_ERROR'
        });
    }
});

// Global error handler (catches unhandled errors in middleware/routes)
app.use((err, req, res, next) => {
    // Log the error
    logger.logError({
        userId: req.user?.id,
        message: err.message,
        endpoint: req.path,
        method: req.method,
        statusCode: err.statusCode || 500
    }).catch(logErr => console.error('Failed to log error:', logErr));

    // Return user-friendly error response
    const statusCode = err.statusCode || 500;
    const errorId = Date.now();

    res.status(statusCode).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        errorId: errorId // For support tickets
    });
});

// Attach Sentry error handler (must be after all routes and before Netlify export)
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
}

// Health check endpoint with dependency verification
app.get('/api/health', apiLimiter, async (req, res) => {
    try {
        const checks = {
            database: false,
            anthropic: !!process.env.ANTHROPIC_API_KEY,
            stripe: !!process.env.STRIPE_SECRET_KEY,
            jwt: !!process.env.JWT_SECRET
        };

        // Test Supabase connection
        try {
            const { data } = await supabaseAdmin.auth.admin.listUsers({ limit: 1 });
            checks.database = true;
        } catch (dbError) {
            console.warn('Database health check failed:', dbError.message);
            checks.database = false;
        }

        const allHealthy = Object.values(checks).every(v => v === true);
        const statusCode = allHealthy ? 200 : 503;

        res.status(statusCode).json({
            status: allHealthy ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            checks,
            message: allHealthy
                ? 'My Mechanic API is running with all dependencies'
                : 'My Mechanic API is running but some dependencies are unavailable'
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            message: 'Health check failed'
        });
    }
});

// Always export the app for Netlify Functions
module.exports = app;

// Only start listening locally (not in Netlify)
if (!process.env.NETLIFY && process.env.CONTEXT !== 'production') {
    app.listen(PORT, () => {
        console.log(`My Mechanic server running on http://localhost:${PORT}`);
        console.log(`API endpoint: http://localhost:${PORT}/api/chat`);
    });
}
