const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase client with anon key (for client-side auth)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Create Supabase admin client with service role (for server-side operations)
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

module.exports = { supabase, supabaseAdmin };
