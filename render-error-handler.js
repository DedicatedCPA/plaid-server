const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);
const logFile = '/opt/render/logs/app.log';

fs.watchFile(logFile, async () => {
    fs.readFile(logFile, 'utf8', async (err, data) => {
        if (err) return console.error("Error reading log file:", err);

        const lastError = data.trim().split('\n').pop(); // Get the last error line
        
        // ✅ Save error to Supabase
        const { error } = await supabase
            .from('error_logs')
            .insert([{ error_message: lastError, source: 'Render' }]);

        if (error) {
            console.error("❌ Failed to log error:", error);
        } else {
            console.log("✅ Render error logged in Supabase.");
        }
    });
});

console.log("📡 Render error monitoring started...");