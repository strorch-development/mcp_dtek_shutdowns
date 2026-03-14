import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  return url;
}

export function makePool() {
  return new Pool({
    connectionString: getDatabaseUrl(),
    max: Number(process.env.PG_POOL_MAX || 5),
  });
}

export async function ensureSchema(pool) {
  const candidates = [
    path.resolve(process.cwd(), 'db', 'schema.sql'),
    (() => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      return path.resolve(__dirname, '..', '..', '..', 'db', 'schema.sql');
    })(),
  ];

  let lastErr;
  for (const schemaPath of candidates) {
    try {
      const sql = await fs.readFile(schemaPath, 'utf8');
      await pool.query(sql);
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Failed to load schema.sql from candidates: ${candidates.join(', ')}. Last error: ${lastErr}`);
}

export async function upsertAddress(pool, address) {
  const trimmed = (address || '').trim();
  if (!trimmed) return null;
  const res = await pool.query(
    `INSERT INTO addresses(address)
     VALUES ($1)
     ON CONFLICT (address) DO UPDATE SET address = EXCLUDED.address
     RETURNING id, address`,
    [trimmed]
  );
  return res.rows[0];
}

export async function listAddresses(pool, limit = 1000) {
  const res = await pool.query(
    `SELECT id, address FROM addresses ORDER BY id ASC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

export async function insertSiteFetch(pool, { url, html, jsonResponses, error }) {
  await pool.query(
    `INSERT INTO site_fetches(url, html, json_responses, error)
     VALUES ($1, $2, $3, $4)`,
    [url, html || null, jsonResponses ? JSON.stringify(jsonResponses) : null, error || null]
  );
}

export async function insertShutdownSnapshot(pool, { addressId, payload }) {
  await pool.query(
    `INSERT INTO shutdown_snapshots(address_id, payload)
     VALUES ($1, $2)`,
    [addressId, JSON.stringify(payload)]
  );
}
