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

        // Create mock response object
        let statusCode = 200;
        const responseHeaders = {};
        const chunks = [];

        const mockResponse = {
            statusCode,
            headers: responseHeaders,
            write(chunk) {
                if (chunk) chunks.push(chunk);
                return true;
            },
            end(chunk) {
                if (chunk) chunks.push(chunk);

                const body = Buffer.concat(chunks).toString('utf-8');
                resolve({
                    statusCode: this.statusCode,
                    headers: this.headers,
                    body: body,
                    isBase64Encoded: false,
                });
            },
            setHeader(name, value) {
                this.headers[name.toLowerCase()] = value;
            },
            getHeader(name) {
                return this.headers[name.toLowerCase()];
            },
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(obj) {
                this.setHeader('content-type', 'application/json');
                this.end(JSON.stringify(obj));
            },
            send(data) {
                this.end(data);
            },
        };

        Object.defineProperty(mockResponse, 'statusCode', {
            get() { return statusCode; },
            set(value) { statusCode = value; },
        });

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
