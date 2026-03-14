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

export async function resolveAddress(pool, address) {
  const a = (address || '').trim();
  if (!a) return null;

  // Exact match first.
  let res = await pool.query('SELECT id, address FROM addresses WHERE address = $1', [a]);
  if (res.rows[0]) return res.rows[0];

  // Fuzzy match.
  res = await pool.query(
    `SELECT id, address
     FROM addresses
     WHERE address ILIKE '%' || $1 || '%'
     ORDER BY length(address) ASC
     LIMIT 1`,
    [a]
  );
  return res.rows[0] || null;
}

export async function listAddresses(pool, q, limit) {
  const lim = Math.max(1, Math.min(2000, Number(limit || 20)));
  if (!q) {
    const res = await pool.query('SELECT address FROM addresses ORDER BY address ASC LIMIT $1', [lim]);
    return res.rows.map((r) => r.address);
  }
  const res = await pool.query(
    `SELECT address
     FROM addresses
     WHERE address ILIKE '%' || $1 || '%'
     ORDER BY address ASC
     LIMIT $2`,
    [q, lim]
  );
  return res.rows.map((r) => r.address);
}

export async function getLatestSnapshot(pool, addressId, limit = 1) {
  const lim = Math.max(1, Math.min(50, Number(limit || 1)));
  const res = await pool.query(
    `SELECT scraped_at, payload
     FROM shutdown_snapshots
     WHERE address_id = $1
     ORDER BY scraped_at DESC
     LIMIT $2`,
    [addressId, lim]
  );
  return res.rows.map((r) => ({ scrapedAt: r.scraped_at, payload: r.payload }));
}
