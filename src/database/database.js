const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function initializeDatabase() {
  try {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS api_requests (
          id UUID PRIMARY KEY,
          method VARCHAR(10) NOT NULL,
          path VARCHAR(255) NOT NULL,
          status_code INTEGER NOT NULL,
          response_time_ms INTEGER NOT NULL,
          user_agent TEXT,
          ip_address VARCHAR(45),
          request_body JSONB,
          query_params JSONB,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          version VARCHAR(10),
          
          -- New detailed fields
          referrer TEXT,
          origin TEXT,
          host TEXT,
          browser VARCHAR(100),
          browser_version VARCHAR(50),
          os VARCHAR(100),
          platform VARCHAR(50),
          is_mobile BOOLEAN,
          is_bot BOOLEAN,
          country VARCHAR(50),
          region VARCHAR(100),
          city VARCHAR(100),
          origin_domain VARCHAR(255),
          request_headers JSONB,
          response_size INTEGER,
          endpoint_category VARCHAR(100)
        )
      `);
  } catch (err) {
    console.error("Error initializing database:", err);
  }
}

module.exports = { initializeDatabase, pool };
