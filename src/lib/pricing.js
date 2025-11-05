// Centralized pricing configuration
// Single source of truth for all plan pricing across the application

// Stripe Price IDs (from environment variables)
const PLAN_PRICES = {
    trial: process.env.STRIPE_PRICE_TRIAL,              // TRIAL tier (£1.99) - max 2 uses per email
    starter: process.env.STRIPE_PRICE_STARTER,          // EXISTING tier
    professional: process.env.STRIPE_PRICE_PROFESSIONAL, // EXISTING tier
    workshop: process.env.STRIPE_PRICE_WORKSHOP         // EXISTING tier
};

// Monthly Recurring Revenue (MRR) for analytics - in GBP
const PLAN_MRR = {
    trial: 1.99,          // TRIAL tier - limited to 2 uses per email
    starter: 4.99,        // EXISTING tier
    professional: 14.99,  // EXISTING tier
    workshop: 39.99       // EXISTING tier
};

// Message limits per plan (credits)
const PLAN_LIMITS = {
    trial: 10,            // TRIAL tier - 10 credits (max 2 uses per email)
    starter: 50,          // EXISTING tier - unchanged
    professional: 200,    // EXISTING tier - unchanged
    workshop: -1          // EXISTING tier - unlimited (unchanged)
};

// Saved conversations limits per plan
const SAVED_CHATS_LIMITS = {
    trial: 0,             // TRIAL tier - no saved chats
    starter: 2,           // EXISTING tier - add 2 saved chats
    professional: 5,      // EXISTING tier - add 5 saved chats
    workshop: 10          // EXISTING tier - add 10 saved chats
};

// Plan descriptions for UI display
const PLAN_DESCRIPTIONS = {
    trial: 'Try us out - 10 credits (max 2 uses)',  // TRIAL tier
    starter: 'Perfect for car owners',              // EXISTING tier
    professional: 'For enthusiasts and mechanics',  // EXISTING tier
    workshop: 'For professional workshops'          // EXISTING tier
};

// Maximum number of times a user can subscribe to trial plan
const TRIAL_MAX_USES = 2;

// Validate pricing configuration on module load
function validatePricingConfig() {
    const missingPrices = [];

    if (!PLAN_PRICES.trial) missingPrices.push('STRIPE_PRICE_TRIAL');
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
    SAVED_CHATS_LIMITS,
    PLAN_DESCRIPTIONS,
    TRIAL_MAX_USES,
    validatePricingConfig
};
