const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory
app.use('/api/', apiLimiter); // Apply rate limiting to all API endpoints

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

// Chat endpoint
app.post('/api/chat', chatLimiter, async (req, res) => {
    try {
        const { message, conversationHistory = [] } = req.body;

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

        res.json({
            response: assistantMessage,
            conversationHistory: [
                ...messages,
                {
                    role: 'assistant',
                    content: assistantMessage
                }
            ]
        });

    } catch (error) {
        console.error('Error calling Claude API:', error);
        res.status(500).json({
            error: 'Failed to get response from AI assistant',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'My Mechanic API is running' });
});

app.listen(PORT, () => {
    console.log(`My Mechanic server running on http://localhost:${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/api/chat`);
});
