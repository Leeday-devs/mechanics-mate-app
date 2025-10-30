// Import the handler directly from server.js
// The server.js handles the serverless-http wrapping internally
const app = require('../../server.js');

// If server.js is running in production, it will export the handler
// Otherwise, just export the app
if (app.handler) {
    exports.handler = app.handler;
} else {
    const serverless = require('serverless-http');
    exports.handler = serverless(app);
}
