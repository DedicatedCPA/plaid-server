// Load environment variables
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const plaid = require('plaid');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// 1. Read environment variables
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';
const PORT = process.env.PORT || 3000;

// Debugging logs to ensure env variables are loaded
console.log("Loaded PLAID_CLIENT_ID:", PLAID_CLIENT_ID);
console.log("Loaded PLAID_SECRET:", PLAID_SECRET);

// 2. Create Plaid client
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

// 3. Endpoint: Create Link Token
app.post('/create_link_token', async (req, res) => {
  try {
    console.log("🔹 Received request to create Link Token...");

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      throw new Error("❌ Missing Plaid credentials in environment variables.");
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'unique_user_id' },
      client_name: "My Bookkeeping Service",
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    });

    console.log("✅ Link token created successfully:", response.data);
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('❌ Error creating link token:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to create link token', details: error.response?.data });
  }
});

// 4. Endpoint: Exchange Public Token for Access Token
app.post('/exchange_public_token', async (req, res) => {
  const { public_token } = req.body;

  if (!public_token) {
    console.error("❌ ERROR: public_token is missing from request body.");
    return res.status(400).json({ error: "public_token is required" });
  }

  try {
    console.log("🔹 Received public_token:", public_token);
    const tokenResponse = await plaidClient.itemPublicTokenExchange({ public_token });

    console.log("✅ Successfully exchanged token:", tokenResponse.data);
    res.json({ access_token: tokenResponse.data.access_token });
  } catch (error) {
    console.error("❌ Error exchanging public token:", error.response ? error.response.data : error);
    res.status(500).json({ error: "Failed to exchange token", details: error.response?.data });
  }
});

// 5. Endpoint: Fetch Transactions and Generate Quote
app.post('/get_transactions', async (req, res) => {
  const { access_token } = req.body;
  try {
    const response = await plaidClient.transactionsGet({
      access_token,
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    });

    const transactions = response.data.transactions;
    const numTransactions = transactions.length;

    // Simple tiered pricing logic
    let price = 100;  // base price
    if (numTransactions > 500) price += 50;
    if (numTransactions > 1000) price += 100;

    res.json({
      transaction_count: numTransactions,
      estimated_quote: `$${price}/month`
    });
  } catch (error) {
    console.error('Error fetching transactions:', error.response ? error.response.data : error);
    res.status(500).json({ error: 'Failed to fetch transactions', details: error.response?.data });
  }
});

// 6. Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
