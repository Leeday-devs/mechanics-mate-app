const serverless = require('serverless-http');
const app = require('../../server.js');

// Wrap Express with serverless-http
// The external_node_modules config in netlify.toml ensures dependencies aren't bundled
exports.handler = serverless(app);
