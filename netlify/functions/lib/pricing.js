// Centralized pricing configuration
// Single source of truth for all plan pricing across the application

// Stripe Price IDs (from environment variables)
const PLAN_PRICES = {
    starter: process.env.STRIPE_PRICE_STARTER,
    professional: process.env.STRIPE_PRICE_PROFESSIONAL,
    workshop: process.env.STRIPE_PRICE_WORKSHOP
};

// Monthly Recurring Revenue (MRR) for analytics - in GBP
const PLAN_MRR = {
    starter: 4.99,
    professional: 14.99,
    workshop: 39.99
};

// Message limits per plan
const PLAN_LIMITS = {
    starter: 50,
    professional: 200,
    workshop: -1 // -1 = unlimited
};

// Plan descriptions for UI display
const PLAN_DESCRIPTIONS = {
    starter: 'Perfect for car owners',
    professional: 'For enthusiasts and mechanics',
    workshop: 'For professional workshops'
};

// Validate pricing configuration on module load
function validatePricingConfig() {
    const missingPrices = [];

    if (!PLAN_PRICES.starter) missingPrices.push('STRIPE_PRICE_STARTER');
    if (!PLAN_PRICES.professional) missingPrices.push('STRIPE_PRICE_PROFESSIONAL');
    if (!PLAN_PRICES.workshop) missingPrices.push('STRIPE_PRICE_WORKSHOP');

    if (missingPrices.length > 0) {
        console.warn('⚠️  WARNING: Missing Stripe Price IDs in environment variables:');
        missingPrices.forEach(varName => console.warn(`   - ${varName}`));
    }

    return missingPrices.length === 0;
}

// Validate on first import
validatePricingConfig();

module.exports = {
    PLAN_PRICES,
    PLAN_MRR,
    PLAN_LIMITS,
    PLAN_DESCRIPTIONS,
    validatePricingConfig
};
