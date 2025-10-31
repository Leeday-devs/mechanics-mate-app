const serverless = require('serverless-http');
const app = require('../../server.js');

// Create serverless handler
const handler = serverless(app, {
    // Don't use basePath - our Express routes already include /api prefix
    basePath: '',
    binary: ['*/*'],
});

// Wrap the handler to add error handling
exports.handler = async (event, context) => {
    console.log(`[Netlify] Method:${event.httpMethod} Path:${event.path} RawPath:${event.rawPath}`);

    try {
        // serverless-http may strip prefixes, so we need to ensure it knows to preserve /api
        // Add the /api prefix back if serverless-http stripped it
        let response = await handler(event, context);

        // If we get a "Cannot GET /auth..." or similar, the /api was stripped
        // Try again with the path preserved
        if (response.body && response.body.includes('Cannot') && !event.path.includes('/api')) {
            // Event path doesn't include /api, so Netlify already stripped it
            // This shouldn't happen, but let's log it
            console.error('[Error] Path issue detected, event.path:', event.path);
        }

        console.log(`[Response] Status: ${response.statusCode}`);
        return response;
    } catch (error) {
        console.error('[Error]', error.message, error.stack);
        return {
            statusCode: 500,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ error: 'Internal Server Error', message: error.message }),
        };
    }
};
