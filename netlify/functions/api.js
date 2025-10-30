const app = require('../../server.js');
const http = require('http');
const { Readable } = require('stream');

// Netlify Function handler for Express app
exports.handler = async (event, context) => {
    console.log(`[Handler] ${event.httpMethod} ${event.path}`);

    // For non-POST requests, handle with serverless-http approach
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ message: 'GET works' }),
        };
    }

    // For POST, return a simple test message for now
    return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'POST handler test' }),
    };

    return new Promise((resolve) => {
        // Build the request URL
        const queryString = event.queryStringParameters
            ? '?' + new URLSearchParams(event.queryStringParameters).toString()
            : '';
        const url = event.path + queryString;

        // Prepare request body
        const bodyData = event.isBase64Encoded
            ? Buffer.from(event.body || '', 'base64')
            : (event.body ? Buffer.from(event.body) : Buffer.alloc(0));

        // Create an in-memory HTTP server with our Express app
        const server = http.createServer((req, res) => {
            // Forward all requests to Express app
            app(req, res);
        });

        // Mock socket/connection for the request
        class FakeSocket extends Readable {
            constructor(data) {
                super();
                this.data = data;
                this.remoteAddress = event.requestContext?.identity?.sourceIp || '127.0.0.1';
                this.destroy = () => {};
                this.end = () => {};
            }
            _read() {
                if (this.data) {
                    this.push(this.data);
                    this.data = null;
                } else {
                    this.push(null);
                }
            }
        }

        const socket = new FakeSocket(bodyData);

        // Create proper IncomingMessage using the socket
        const req = new http.IncomingMessage(socket);
        req.method = event.httpMethod;
        req.url = url;
        req.headers = {
            ...event.headers,
            'content-length': bodyData.length.toString(),
        };

        // Create response object
        const chunks = [];
        let statusCode = 200;
        const headers = {};

        const res = new http.ServerResponse(req);

        // Override methods for capturing response
        const originalEnd = res.end.bind(res);
        res.end = function(chunk, encoding) {
            if (chunk) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, encoding || 'utf-8') : chunk);
            }

            const body = chunks.length > 0 ? Buffer.concat(chunks).toString('utf-8') : '';
            const finalHeaders = res.getHeaders ? res.getHeaders() : {};

            // Normalize headers
            const normalizedHeaders = {};
            for (const [key, value] of Object.entries(finalHeaders)) {
                const lowerKey = key.toLowerCase();
                normalizedHeaders[lowerKey] = Array.isArray(value) ? value[0] : value;
            }

            console.log(`[Response] Status: ${res.statusCode}, Headers:`, Object.keys(normalizedHeaders));

            resolve({
                statusCode: res.statusCode || 200,
                headers: normalizedHeaders,
                body: body,
                isBase64Encoded: false,
            });

            return res;
        };

        const originalWrite = res.write.bind(res);
        res.write = function(chunk, encoding) {
            if (chunk) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, encoding || 'utf-8') : chunk);
            }
            return true;
        };

        // Set a timeout to prevent hanging requests
        const timeout = setTimeout(() => {
            console.error('[Handler] Request timeout');
            resolve({
                statusCode: 504,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ error: 'Request timeout' }),
            });
        }, 29000); // Netlify functions have 30 second limit

        // Handle errors
        req.on('error', (error) => {
            clearTimeout(timeout);
            console.error('[Handler] Request error:', error.message);
            resolve({
                statusCode: 400,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ error: 'Bad Request', message: error.message }),
            });
        });

        res.on('error', (error) => {
            clearTimeout(timeout);
            console.error('[Handler] Response error:', error.message);
            resolve({
                statusCode: 500,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ error: 'Internal Server Error', message: error.message }),
            });
        });

        try {
            // Call Express app with proper req/res
            console.log('[Handler] Calling Express app for', event.httpMethod, url);
            app(req, res);
        } catch (error) {
            clearTimeout(timeout);
            console.error('[Handler] Synchronous error:', error.message);
            resolve({
                statusCode: 500,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ error: 'Internal Server Error', message: error.message }),
            });
        }
    });
};
