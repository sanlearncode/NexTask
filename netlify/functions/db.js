const { Client } = require("pg");

async function getClient() {
  const client = new Client({
    connectionString: process.env.NETLIFY_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  // 👉 Tạo bảng users
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // 👉 Tạo bảng names (có user_id)
  await client.query(`
    CREATE TABLE IF NOT EXISTS names (
      id         SERIAL PRIMARY KEY,
      name       TEXT        NOT NULL,
      user_id    INT REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
  ALTER TABLE names ADD COLUMN IF NOT EXISTS user_id INT
`);

  return client;
}

module.exports = { getClient };