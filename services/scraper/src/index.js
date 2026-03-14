import { makePool, ensureSchema, upsertAddress, listAddresses, insertSiteFetch, insertShutdownSnapshot } from './pg.js';
import { fetchRenderedPage, discoverAddressesFromJson } from './scrape.js';

function envInt(name, def) {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseSeedAddresses() {
  const raw = (process.env.SEED_ADDRESSES || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function runOnce(pool) {
  const url = process.env.DTEK_URL || 'https://www.dtek-krem.com.ua/ua/shutdowns';

  // 1) Fetch overview (and attempt to discover addresses).
  try {
    const { html, jsonResponses } = await fetchRenderedPage({ url });
    await insertSiteFetch(pool, { url, html, jsonResponses, error: null });

    const discovered = discoverAddressesFromJson(jsonResponses);
    for (const a of discovered.slice(0, envInt('DISCOVER_LIMIT', 5000))) {
      await upsertAddress(pool, a);
    }
  } catch (e) {
    await insertSiteFetch(pool, { url, html: null, jsonResponses: null, error: String(e) });
  }

  // 2) Snapshot per-address.
  const rows = await listAddresses(pool, envInt('ADDRESS_LIMIT', 2000));
  for (const row of rows) {
    try {
      const { html, jsonResponses, selected } = await fetchRenderedPage({ url, addressQuery: row.address });
      await insertShutdownSnapshot(pool, {
        addressId: row.id,
        payload: {
          address: row.address,
          url,
          selected,
          fetchedAt: new Date().toISOString(),
          html,
          jsonResponses,
        },
      });
    } catch (e) {
      await insertShutdownSnapshot(pool, {
        addressId: row.id,
        payload: {
          address: row.address,
          url,
          selected: false,
          fetchedAt: new Date().toISOString(),
          error: String(e),
        },
      });
    }

    // Small pacing to reduce load.
    await sleep(envInt('PER_ADDRESS_DELAY_MS', 300));
  }
}

async function main() {
  const sleepSeconds = envInt('SLEEP_SECONDS', 600);

  const pool = makePool();
  await ensureSchema(pool);

  for (const a of parseSeedAddresses()) {
    await upsertAddress(pool, a);
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const started = Date.now();
    console.log(`[scraper] run started: ${new Date().toISOString()}`);
    await runOnce(pool);
    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log(`[scraper] run finished in ${elapsed}s; sleeping ${sleepSeconds}s`);
    await sleep(sleepSeconds * 1000);
  }
}

main().catch((e) => {
  console.error('[scraper] fatal:', e);
  process.exit(1);
});
