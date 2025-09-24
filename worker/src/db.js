import dotenv from 'dotenv';
import pkg from 'pg';


dotenv.config();
const { Pool } = pkg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export async function q(sql, params){ const c = await pool.connect(); try { return await c.query(sql, params);} finally { c.release(); } }
