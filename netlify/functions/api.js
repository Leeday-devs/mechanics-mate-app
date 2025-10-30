const app = require('./server.js');
const { Readable } = require('stream');

console.log('[API] Module loaded. app type:', typeof app, 'app keys:', Object.keys(app || {}).slice(0, 5));

// Direct Netlify Function handler for Express app
// Avoids serverless-http's framework detection issues
exports.handler = async (event, context) => {
    console.log(`[Handler] ${event.httpMethod} ${event.path}`);

    return new Promise((resolve) => {
        // Build full URL
        const queryString = event.queryStringParameters
            ? '?' + new URLSearchParams(event.queryStringParameters).toString()
            : '';
        const url = event.path + queryString;

        // Create a readable stream for the body
        const body = event.isBase64Encoded
            ? Buffer.from(event.body || '', 'base64')
            : (event.body || '');

        // Create mock Node.js request object
        const mockRequest = new Readable({
            read() {}
        });

        if (body) {
            mockRequest.push(body);
        }
        mockRequest.push(null);

        // Copy headers
        mockRequest.headers = {
            ...event.headers,
            'content-length': body?.length || '0',
        };

        // Set request properties
        mockRequest.method = event.httpMethod;
        mockRequest.url = url;

        // Create mock response object with proper Express compatibility
        let statusCode = 200;
        const responseHeaders = {};
        const chunks = [];
        let isEnded = false;

        const mockResponse = {
            statusCode: 200,
            headers: responseHeaders,
            headersSent: false,
            write(chunk, encoding) {
                if (!isEnded && chunk) {
                    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, encoding || 'utf8') : chunk);
                }
                return true;
            },
            end(chunk, encoding) {
                if (isEnded) return this;
                isEnded = true;

                if (chunk) {
                    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, encoding || 'utf8') : chunk);
                }

                const body = chunks.length > 0
                    ? Buffer.concat(chunks).toString('utf-8')
                    : '';

                resolve({
                    statusCode: this.statusCode || 200,
                    headers: this.headers || {},
                    body: body,
                    isBase64Encoded: false,
                });

                return this;
            },
            setHeader(name, value) {
                if (name && value !== undefined && value !== null) {
                    this.headers[name.toLowerCase()] = value;
                }
                return this;
            },
            getHeader(name) {
                return this.headers && this.headers[name.toLowerCase ? name.toLowerCase() : name];
            },
            removeHeader(name) {
                if (this.headers && name) {
                    delete this.headers[name.toLowerCase()];
                }
                return this;
            },
            hasHeader(name) {
                return this.headers && !!this.headers[name.toLowerCase ? name.toLowerCase() : name];
            },
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(obj) {
                this.setHeader('content-type', 'application/json');
                return this.end(JSON.stringify(obj));
            },
            send(data) {
                if (typeof data === 'object' && data !== null) {
                    this.setHeader('content-type', 'application/json');
                    return this.end(JSON.stringify(data));
                }
                return this.end(data);
            },
        };

        try {
            // Call the Express app
            app(mockRequest, mockResponse);
        } catch (error) {
            console.error('Error calling Express app:', error);
            resolve({
                statusCode: 500,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ error: 'Internal Server Error', message: error.message }),
            });
        }
    });
};
