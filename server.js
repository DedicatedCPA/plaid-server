// ✅ Load Environment Variables
require('dotenv').config();
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || 'production';
const PORT = process.env.PORT || 3000;
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // ✅ Only declared once
const plaid = require('plaid');
const { query } = require('./database'); 
const sgMail = require('@sendgrid/mail');

const app = express();
app.use(bodyParser.json());

// ✅ CORS Configuration
const corsOptions = {
  origin: "*", // ✅ Allow all origins temporarily
  methods: "GET,POST",
  allowedHeaders: "Content-Type"
};
app.use(cors(corsOptions));

// ✅ Set Up SendGrid API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ✅ 1. Read Environment Variables (Moved up)

// ✅ 2. Create Plaid Client
const plaidClient = new plaid.PlaidApi(
  new plaid.Configuration({
    basePath: plaid.PlaidEnvironments[PLAID_ENV],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
        "PLAID-SECRET": PLAID_SECRET
      }
    }
  })
);

// ✅ 3. Create Plaid Link Token (Used by Frontend)
app.post('/create_link_token', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'unique_user_id' },
      client_name: "Dedicated CPA",
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    });

    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('❌ Error creating link token:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to create link token', details: error.response?.data });
  }
});

// ✅ 4. Exchange Public Token for Access Token
app.post('/exchange_public_token', async (req, res) => {
  const { public_token, phone_number, client_name } = req.body;

  if (!public_token || !phone_number || !client_name) {
    return res.status(400).json({ error: "public_token, phone_number, and client_name are required" });
  }

  try {
    const tokenResponse = await plaidClient.itemPublicTokenExchange({ public_token });

    // ✅ Store Access Token & Client Details in Database
    await query(
      "INSERT INTO users (phone_number, client_name, access_token, item_id) VALUES ($1, $2, $3, $4) ON CONFLICT (phone_number) DO NOTHING",
      [phone_number, client_name, tokenResponse.data.access_token, tokenResponse.data.item_id]
    );

    res.json({ message: "✅ Account successfully linked." });
  } catch (error) {
    console.error("❌ Error exchanging public token:", error.response ? error.response.data : error);
    res.status(500).json({ error: "Failed to exchange token", details: error.response?.data });
  }
});

// ✅ 5. Fetch Transactions & Store Quote Internally
app.post('/get_transactions', async (req, res) => {
  const { access_token, phone_number, client_name } = req.body;

  if (!access_token || !phone_number || !client_name) {
    return res.status(400).json({ error: "access_token, phone_number, and client_name are required" });
  }

  try {
    const response = await plaidClient.transactionsGet({
      access_token,
      start_date: '2023-01-01',
      end_date: '2024-01-01'
    });

    const transactions = response.data.transactions;
    const numTransactions = transactions.length;
    const accounts = response.data.accounts.map(acc => acc.mask); // ✅ Get last 4 digits for each account

    // ✅ Calculate Transactions Per Month (Average Over 12 Months)
    const transactionsPerMonth = Math.round(numTransactions / 12);

    // ✅ Pricing Formula
    let price = Math.max(110, numTransactions * 0.85); // $110 minimum or $0.85 per transaction
    if (accounts.length > 0) price += 25; // First account $25
    if (accounts.length > 1) price += 20; // Second account $20
    if (accounts.length > 2) price += 20; // Third account $20
    if (accounts.length > 3) price += (accounts.length - 3) * 15; // Fourth+ $15 each

    // ✅ Store Quote in Database (Internal)
    await query(
      "INSERT INTO quotes (client_name, phone_number, last_four_accounts, transactions_per_month, quote_amount, status) VALUES ($1, $2, $3, $4, $5, 'Pending')",
      [client_name, phone_number, JSON.stringify(accounts), transactionsPerMonth, price]
    );

    // ✅ Send Email Notification to Your Team
    const msg = {
      to: process.env.ALERT_EMAIL,
      from: "client@dedicatedcpa.com",
      subject: `📢 New Quote Available - ${client_name}`,
      html: `<h2>New Quote Available</h2>
             <p><strong>Client Name:</strong> ${client_name}</p>
             <p><strong>Phone Number:</strong> ${phone_number}</p>
             <p><strong>Last 4 Digits of Bank Accounts:</strong> ${accounts.join(", ")}</p>
             <p><strong>Transactions Per Month:</strong> ${transactionsPerMonth}</p>
             <p><strong>Estimated Quote:</strong> $${price}/month</p>
             <p><strong>Status:</strong> Pending</p>`
    };
    await sgMail.send(msg);

    res.json({ message: "✅ Transactions retrieved successfully." });
  } catch (error) {
    console.error('❌ Error fetching transactions:', error.response ? error.response.data : error);
    res.status(500).json({ error: 'Failed to fetch transactions', details: error.response?.data });
  }
});

// ✅ 6. Admin Route: View All Quotes
app.get('/admin/quotes', async (req, res) => {
  try {
    const quotes = await query("SELECT * FROM quotes ORDER BY created_at DESC");
    res.json(quotes);
  } catch (error) {
    console.error("❌ Error fetching quotes:", error);
    res.status(500).json({ error: "Failed to fetch quotes" });
  }
});

// ✅ Start the Server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});