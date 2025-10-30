// Ensure Express is available before requiring serverless-http
// This helps serverless-http detect the framework correctly
const express = require('express');

const serverless = require('serverless-http');
const app = require('./server.js');

// Wrap Express with serverless-http
exports.handler = serverless(app, {
    // Explicitly tell serverless-http what framework we're using
});
