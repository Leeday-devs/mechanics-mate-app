const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

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
const requiredEnvVars = [
    'ANTHROPIC_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'JWT_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
}

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
const authRoutes = require('./routes/auth');
const subscriptionRoutes = require('./routes/subscriptions');
const adminRoutes = require('./routes/admin');
const logsRoutes = require('./routes/logs');
const { authenticateToken, requireSubscription } = require('./middleware/auth');
const { requestLoggingMiddleware, errorLoggingMiddleware, securityLoggingMiddleware } = require('./middleware/logger');
const { checkQuota, incrementQuota, logMessage } = require('./utils/quota');
const logger = require('./lib/logger');

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

// Mount API routes
// NOTE: Static files are served by Netlify directly from the public/ directory
// This function only handles API endpoints
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/logs', logsRoutes); // Comprehensive logging endpoints

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Function to search UK automotive forums for relevant information
async function searchForums(vehicleInfo, userQuestion) {
    try {
        // Build search query targeting popular UK car forums
        const searchQuery = `${vehicleInfo} ${userQuestion} site:pistonheads.com OR site:honestjohn.co.uk OR site:reddit.com/r/CarTalkUK OR site:reddit.com/r/MechanicAdvice OR site:ukworkshop.co.uk`;

        // Using Google Custom Search API (you'll need to add GOOGLE_SEARCH_API_KEY and SEARCH_ENGINE_ID to .env)
        const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
        const searchEngineId = process.env.SEARCH_ENGINE_ID;

        if (!searchApiKey || !searchEngineId) {
            console.log('Search API not configured, skipping forum search');
            return null;
        }

        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${searchApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}&num=5`;

        const response = await axios.get(searchUrl, { timeout: 5000 });

        if (response.data.items && response.data.items.length > 0) {
            // Extract relevant snippets from search results
            const forumResults = response.data.items.map(item => ({
                title: item.title,
                snippet: item.snippet,
                link: item.link
            }));

            return forumResults;
        }

        return null;
    } catch (error) {
        console.error('Forum search error:', error.message);
        return null;
    }
}

// Chat endpoint - now requires authentication and active subscription
app.post('/api/chat', chatLimiter, authenticateToken, requireSubscription, async (req, res) => {
    console.error('🚀 CHAT ENDPOINT REACHED');
    try {
        const { message, conversationHistory = [] } = req.body;
        const userId = req.user.id;
        const subscription = req.subscription;

        // Validation
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (typeof message !== 'string') {
            return res.status(400).json({ error: 'Message must be a string' });
        }

        if (message.trim().length === 0) {
            return res.status(400).json({ error: 'Message cannot be empty' });
        }

        if (message.length > 5000) {
            return res.status(400).json({ error: 'Message is too long. Maximum length is 5000 characters.' });
        }

        if (!Array.isArray(conversationHistory)) {
            return res.status(400).json({ error: 'Conversation history must be an array' });
        }

        if (conversationHistory.length > 50) {
            return res.status(400).json({ error: 'Conversation history is too long. Please start a new conversation.' });
        }

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

        // Build messages array for Claude
        const messages = [
            ...conversationHistory,
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
        console.log('Searching forums for:', vehicleInfo, cleanMessage);
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

ANSWER FORMAT:
- ⚠️ ALWAYS START by acknowledging the specific vehicle if provided (e.g., "For your 2018 Ford Focus 1.5L Petrol...")
- Then provide a clear, direct answer SPECIFIC TO THAT VEHICLE
- Include UK-specific details (torque specs in Nm, fluid types, capacities in litres) FOR THAT SPECIFIC MODEL
- Mention if this is a common issue for THIS SPECIFIC VEHICLE in the UK
- Reference MOT requirements if relevant TO THIS VEHICLE
- Provide step-by-step instructions when applicable, TAILORED TO THIS SPECIFIC MODEL
- Always include safety warnings when relevant
- If uncertain, recommend professional diagnosis at a UK garage or approved dealer SPECIALISING IN THIS MAKE

IMPORTANT SAFETY RULES:
- If a repair is dangerous or requires special tools, recommend professional help from a UK garage
- Always mention safety precautions (axle stands, eye protection, etc.)
- Warn about potential risks (fire, injury, vehicle damage)
- For electrical or fuel system work, emphasise disconnecting the battery
- Never recommend shortcuts that compromise safety
- Reference UK health and safety guidelines

Be thorough, accurate, and always prioritise the user's safety. When in doubt, recommend consulting a qualified UK mechanic or approved dealer.`;

        // Call Claude API
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

        res.json({
            response: assistantMessage,
            conversationHistory: [
                ...messages,
                {
                    role: 'assistant',
                    content: assistantMessage
                }
            ],
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

// Attach Sentry error handler (must be after all routes and before Netlify export)
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
}

// Health check endpoint
app.get('/api/health', apiLimiter, (req, res) => {
    res.json({ status: 'ok', message: 'My Mechanic API is running' });
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
