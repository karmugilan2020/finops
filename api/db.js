import dotenv from 'dotenv';
import pkg from 'pg';
dotenv.config();
const { Pool } = pkg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export async function query(q, params) {
  const client = await pool.connect();
  try { return await client.query(q, params); }
  finally { client.release(); }
}

