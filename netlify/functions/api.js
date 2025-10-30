// Use the built-in Netlify serverless function adapter
// Import Express app
const app = require('../../server.js');

// Netlify serverless handler
exports.handler = async (event, context) => {
    // Log incoming request
    console.log(`[API] ${event.httpMethod} ${event.path}`);

    try {
        // Use a simple approach - create a minimal http listener
        const http = require('http');

        return new Promise((resolve, reject) => {
            // Create a minimal request object
            const req = {
                method: event.httpMethod,
                url: event.path + (event.queryStringParameters
                    ? '?' + new URLSearchParams(event.queryStringParameters).toString()
                    : ''),
                headers: {
                    ...event.headers,
                    'content-type': event.headers['content-type'] || 'application/json',
                },
                on: () => {}, // Mock event emitter
                once: () => {}, // Mock event emitter
                rawBody: event.isBase64Encoded
                    ? Buffer.from(event.body || '', 'base64').toString()
                    : (event.body || ''),
            };

            // Add body to request if present
            if (event.body) {
                req.body = event.isBase64Encoded
                    ? Buffer.from(event.body, 'base64').toString()
                    : event.body;
            }

            // Create a minimal response object
            const res = {
                statusCode: 200,
                headers: {},
                body: '',
                _chunks: [],
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                setHeader(name, value) {
                    this.headers[name.toLowerCase()] = value;
                },
                getHeader(name) {
                    return this.headers[name.toLowerCase()];
                },
                write(chunk) {
                    this._chunks.push(chunk);
                    return true;
                },
                end(chunk) {
                    if (chunk) {
                        this._chunks.push(chunk);
                    }
                    this.body = this._chunks.map(c =>
                        typeof c === 'string' ? c : c.toString()
                    ).join('');

                    resolve({
                        statusCode: this.statusCode,
                        headers: this.headers,
                        body: this.body,
                        isBase64Encoded: false,
                    });
                },
            };

            // Add request body parsing capability
            const bodyParser = require('body-parser');
            if (event.body && req.method !== 'GET') {
                try {
                    req.body = event.isBase64Encoded
                        ? JSON.parse(Buffer.from(event.body, 'base64').toString())
                        : (typeof event.body === 'string' ? JSON.parse(event.body) : event.body);
                } catch (e) {
                    req.body = event.body;
                }
            }

            // Call the Express app directly
            try {
                app(req, res);
            } catch (error) {
                console.error('Express handler error:', error);
                resolve({
                    statusCode: 500,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        error: 'Internal server error',
                        message: error.message
                    }),
                });
            }
        });
    } catch (error) {
        console.error('Handler error:', error);
        return {
            statusCode: 500,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            }),
        };
    }
};
