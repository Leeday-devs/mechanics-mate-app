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
    console.log(`[Netlify] Method:${event.httpMethod} Path:${event.path} RawPath:${event.rawPath}`);

    try {
        // Remove leading /api if present since serverless-http will handle routing
        const pathToUse = event.path.startsWith('/api/') ? event.path.substring(4) : event.path;
        const modifiedEvent = {
            ...event,
            path: pathToUse,
            rawPath: pathToUse,
        };

        const response = await handler(modifiedEvent, context);
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
