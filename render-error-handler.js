const fs = require('fs');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const logFile = '/opt/render/logs/app.log'; // Adjust path if needed

fs.watchFile(logFile, (curr, prev) => {
    fs.readFile(logFile, 'utf8', (err, data) => {
        if (err) return console.error("Error reading log file:", err);

        const lastError = data.trim().split('\n').pop(); // Get the last error line
        
        const msg = {
            to: process.env.ALERT_EMAIL,
            from: 'client@dedicatedcpa.com',
            subject: '🚨 Render Server Error Alert!',
            text: `An error occurred in the Render server: \n\n${lastError}`,
            html: `<p><strong>Error Details:</strong></p><pre>${lastError}</pre>`
        };

        sgMail.send(msg).then(() => {
            console.log("✅ Render error alert sent.");
        }).catch(err => {
            console.error("❌ Failed to send Render error alert:", err);
        });
    });
});

console.log("📡 Render error monitoring started...");
