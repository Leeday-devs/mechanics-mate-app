// Check webhook events
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    try {
        console.log('Fetching webhook events...\n');

        const { data, error } = await supabase
            .from('webhook_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error fetching webhooks:', error);
            return;
        }

        if (!data || data.length === 0) {
            console.log('No webhook events found');
            return;
        }

        console.log(`Found ${data.length} webhook events:\n`);

        data.forEach((event, i) => {
            console.log(`${i + 1}. Event ID: ${event.event_id}`);
            console.log(`   Type: ${event.event_type}`);
            console.log(`   Status: ${event.status}`);
            console.log(`   Created: ${event.created_at}`);
            console.log('');
        });
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

main();
