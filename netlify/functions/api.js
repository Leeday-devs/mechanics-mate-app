const app = require('./server.js');
const http = require('http');

// Create a persistent HTTP server that we'll use for all requests
const server = http.createServer(app);

// Netlify Function handler for Express app
// Uses Node.js http module to properly run Express
exports.handler = async (event, context) => {
    console.log(`[Handler] ${event.httpMethod} ${event.path}`);

    return new Promise((resolve) => {
        // Build the request URL
        const queryString = event.queryStringParameters
            ? '?' + new URLSearchParams(event.queryStringParameters).toString()
            : '';
        const url = event.path + queryString;

        // Prepare request body
        const body = event.isBase64Encoded
            ? Buffer.from(event.body || '', 'base64').toString()
            : (event.body || '');

        // Create a fake request/response using the http module
        const fakeReq = new http.IncomingMessage(null);
        fakeReq.method = event.httpMethod;
        fakeReq.url = url;
        fakeReq.httpVersion = '1.1';
        fakeReq.headers = {
            ...event.headers,
            'content-length': Buffer.byteLength(body),
        };
        fakeReq.socket = {
            remoteAddress: event.requestContext?.identity?.sourceIp || '127.0.0.1',
            destroy() {},
        };

        // Create a fake response
        const chunks = [];
        const fakeRes = new http.ServerResponse(fakeReq);

        const originalEnd = fakeRes.end.bind(fakeRes);
        fakeRes.end = function(chunk, encoding) {
            if (chunk) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, encoding || 'utf-8') : chunk);
            }

            const body = Buffer.concat(chunks).toString('utf-8');

            // Get all headers and normalize them
            const normalizedHeaders = {};
            const headers = fakeRes.getHeaders();

            // Also add raw headers
            const rawHeaders = fakeRes.getRawHeaders ? fakeRes.getRawHeaders() : [];
            for (let i = 0; i < rawHeaders.length; i += 2) {
                const name = rawHeaders[i];
                const value = rawHeaders[i + 1];

                // Normalize header names to lowercase
                const lowerName = typeof name === 'string' ? name.toLowerCase() : name;

                // For multi-value headers, take the first value or join
                if (normalizedHeaders[lowerName]) {
                    // Header already exists, skip (keep first value)
                } else {
                    normalizedHeaders[lowerName] = value;
                }
            }

            console.log(`[Response] Status: ${fakeRes.statusCode}, Headers:`, Object.keys(normalizedHeaders));

            resolve({
                statusCode: fakeRes.statusCode || 200,
                headers: normalizedHeaders,
                body: body,
                isBase64Encoded: false,
            });

            return fakeRes;
        };

        const originalWrite = fakeRes.write.bind(fakeRes);
        fakeRes.write = function(chunk, encoding) {
            if (chunk) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, encoding || 'utf-8') : chunk);
            }
            return true;
        };

        // Set a timeout to prevent hanging requests
        const timeout = setTimeout(() => {
            console.error('[Handler] Request timeout');
            if (!fakeRes.headersSent) {
                resolve({
                    statusCode: 504,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ error: 'Request timeout' }),
                });
            }
        }, 29000); // Netlify functions have 30 second limit

        // Handle errors from the response
        fakeRes.on('error', (error) => {
            clearTimeout(timeout);
            console.error('[Handler] Response error:', error);
            if (!fakeRes.headersSent) {
                resolve({
                    statusCode: 500,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ error: 'Internal Server Error', message: error.message }),
                });
            }
        });

        // Handle errors from the request
        fakeReq.on('error', (error) => {
            clearTimeout(timeout);
            console.error('[Handler] Request error:', error);
            if (!fakeRes.headersSent) {
                resolve({
                    statusCode: 400,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ error: 'Bad Request', message: error.message }),
                });
            }
        });

        try {
            // Start the request
            if (body) {
                fakeReq.push(body);
            }
            fakeReq.push(null);

            // Call Express app
            app(fakeReq, fakeRes);
        } catch (error) {
            clearTimeout(timeout);
            console.error('[Handler] Synchronous error:', error);
            resolve({
                statusCode: 500,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ error: 'Internal Server Error', message: error.message }),
            });
        }
    });
};
