// Centralized pricing configuration
// Single source of truth for all plan pricing across the application

// Stripe Price IDs (from environment variables)
const PLAN_PRICES = {
    basic: process.env.STRIPE_PRICE_BASIC,
    starter: process.env.STRIPE_PRICE_STARTER,
    professional: process.env.STRIPE_PRICE_PROFESSIONAL,
    unlimited: process.env.STRIPE_PRICE_UNLIMITED,
    // Legacy support - map old workshop to new unlimited
    workshop: process.env.STRIPE_PRICE_UNLIMITED || process.env.STRIPE_PRICE_WORKSHOP
};

// Monthly Recurring Revenue (MRR) for analytics - in GBP
const PLAN_MRR = {
    basic: 1.99,
    starter: 4.99,
    professional: 14.99,
    unlimited: 39.99,
    // Legacy support
    workshop: 39.99
};

// Message limits per plan (credits)
const PLAN_LIMITS = {
    basic: 10,
    starter: 50,
    professional: 200,
    unlimited: -1, // -1 = unlimited
    // Legacy support
    workshop: -1
};

// Saved conversations limits per plan
const SAVED_CHATS_LIMITS = {
    basic: 0,
    starter: 2,
    professional: 5,
    unlimited: 10,
    // Legacy support
    workshop: 10
};

// Plan descriptions for UI display
const PLAN_DESCRIPTIONS = {
    basic: 'Essential for basic car queries',
    starter: 'Perfect for car owners',
    professional: 'For enthusiasts and mechanics',
    unlimited: 'For professional workshops',
    // Legacy support
    workshop: 'For professional workshops'
};

// Validate pricing configuration on module load
function validatePricingConfig() {
    const missingPrices = [];

    if (!PLAN_PRICES.basic) missingPrices.push('STRIPE_PRICE_BASIC');
    if (!PLAN_PRICES.starter) missingPrices.push('STRIPE_PRICE_STARTER');
    if (!PLAN_PRICES.professional) missingPrices.push('STRIPE_PRICE_PROFESSIONAL');
    if (!PLAN_PRICES.unlimited) missingPrices.push('STRIPE_PRICE_UNLIMITED');

    if (missingPrices.length > 0) {
        console.warn('⚠️  WARNING: Missing Stripe Price IDs in environment variables:');
        missingPrices.forEach(varName => console.warn(`   - ${varName}`));
        console.warn('   Note: Legacy STRIPE_PRICE_WORKSHOP still supported for backward compatibility');
    }

    return missingPrices.length === 0;
}

// Validate on first import
validatePricingConfig();

module.exports = {
    PLAN_PRICES,
    PLAN_MRR,
    PLAN_LIMITS,
    SAVED_CHATS_LIMITS,
    PLAN_DESCRIPTIONS,
    validatePricingConfig
};
