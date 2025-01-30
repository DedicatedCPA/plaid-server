require('dotenv').config();
const { Pool } = require('pg');

// 🔹 Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Supabase/Render PostgreSQL
});

// ✅ Function to run database queries
const query = async (text, params) => {
  try {
    const result = await pool.query(text, params);
    return result.rows;
  } catch (error) {
    console.error("❌ Database Error:", error);
    throw error;
  }
};

// 📌 Export database connection
module.exports = { pool, query };