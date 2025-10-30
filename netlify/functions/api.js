const app = require('./server.js');
const { EventEmitter } = require('events');
const { Readable } = require('stream');

// Netlify Function handler for Express app
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

        // Create a readable stream for the request body
        const createBodyStream = () => {
            const stream = new Readable();
            if (body) {
                stream.push(body);
            }
            stream.push(null);
            return stream;
        };

        // Create a mock request object that extends EventEmitter
        const bodyStream = createBodyStream();
        const fakeReq = Object.assign(bodyStream, {
            method: event.httpMethod,
            url: url,
            httpVersion: '1.1',
            httpVersionMajor: 1,
            httpVersionMinor: 1,
            headers: {
                ...event.headers,
                'content-length': Buffer.byteLength(body),
                'content-type': event.headers['content-type'] || 'application/json',
            },
            socket: {
                remoteAddress: event.requestContext?.identity?.sourceIp || '127.0.0.1',
                destroy() {},
                end() {},
            },
            connection: {
                destroy() {},
                end() {},
            },
        });

        // Create a mock response object
        const chunks = [];
        let isEnded = false;

        const fakeRes = Object.assign(new EventEmitter(), {
            statusCode: 200,
            headers: {},
            headersSent: false,
            finished: false,

            write(chunk, encoding) {
                if (chunk && !isEnded) {
                    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, encoding || 'utf-8') : chunk);
                }
                return true;
            },

            end(chunk, encoding) {
                if (isEnded) return this;
                isEnded = true;

                if (chunk) {
                    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, encoding || 'utf-8') : chunk);
                }

                const body = chunks.length > 0 ? Buffer.concat(chunks).toString('utf-8') : '';

                // Get headers and normalize them
                const normalizedHeaders = {};
                for (const [key, value] of Object.entries(this.headers || {})) {
                    const lowerKey = key.toLowerCase();
                    // Keep only first value for multi-value headers
                    if (!normalizedHeaders[lowerKey]) {
                        normalizedHeaders[lowerKey] = Array.isArray(value) ? value[0] : value;
                    }
                }

                console.log(`[Response] Status: ${this.statusCode}, Headers:`, Object.keys(normalizedHeaders));

                resolve({
                    statusCode: this.statusCode || 200,
                    headers: normalizedHeaders,
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
                return this.headers && this.headers[name.toLowerCase && name.toLowerCase ? name.toLowerCase() : name];
            },

            removeHeader(name) {
                if (this.headers && name) {
                    delete this.headers[name.toLowerCase && name.toLowerCase ? name.toLowerCase() : name];
                }
                return this;
            },

            hasHeader(name) {
                return !!(this.headers && this.headers[name.toLowerCase && name.toLowerCase ? name.toLowerCase() : name]);
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
        });

        // Set a timeout to prevent hanging requests
        const timeout = setTimeout(() => {
            console.error('[Handler] Request timeout');
            if (!isEnded) {
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
            if (!isEnded) {
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
            if (!isEnded) {
                resolve({
                    statusCode: 400,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ error: 'Bad Request', message: error.message }),
                });
            }
        });

        try {
            // Call Express app
            app(fakeReq, fakeRes);
        } catch (error) {
            clearTimeout(timeout);
            console.error('[Handler] Synchronous error:', error);
            if (!isEnded) {
                resolve({
                    statusCode: 500,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ error: 'Internal Server Error', message: error.message }),
                });
            }
        }
    });
};
