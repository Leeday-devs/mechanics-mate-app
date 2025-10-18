const Stripe = require('stripe');
require('dotenv').config();

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = stripe;
