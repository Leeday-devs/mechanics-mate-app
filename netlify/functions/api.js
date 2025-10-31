const serverless = require('serverless-http');
const app = require('../../server.js');

// Create serverless handler
const handler = serverless(app, {
    // Don't strip basePath since Netlify handles routing
    basePath: '',
    binary: ['*/*'],
});

// Wrap the handler to add error handling
exports.handler = async (event, context) => {
    console.log(`[Netlify] ${event.httpMethod} ${event.path}`);

    try {
        const response = await handler(event, context);
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
