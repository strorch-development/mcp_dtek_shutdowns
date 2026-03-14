import { chromium } from 'playwright';

const DEFAULT_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function looksLikeAddress(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  if (t.length < 6 || t.length > 200) return false;
  // Very rough heuristic for UA addresses.
  return /\b(вул\.|вулиця|просп\.|пров\.|бул\.|площа|буд\.|д\.|ул\.|street|st\.|house|кв\.|квартира)\b/i.test(t);
}

function extractCandidateStrings(obj, out, keyHint = '') {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'string') {
    if (looksLikeAddress(obj) || /address|addr|street|house/i.test(keyHint)) out.add(obj.trim());
    return;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) extractCandidateStrings(v, out, keyHint);
    return;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      extractCandidateStrings(v, out, k);
    }
  }
}

export function discoverAddressesFromJson(jsonResponses) {
  const out = new Set();
  for (const j of jsonResponses || []) {
    extractCandidateStrings(j, out);
  }
  return Array.from(out);
}

export async function fetchRenderedPage({ url, addressQuery }) {
  const jsonResponses = [];
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext({
      userAgent: process.env.USER_AGENT || DEFAULT_UA,
      locale: 'uk-UA',
    });

    const page = await context.newPage();

    page.on('response', async (resp) => {
      try {
        const ct = (resp.headers()['content-type'] || '').toLowerCase();
        if (!ct.includes('application/json')) return;
        const u = resp.url();
        // Avoid megabytes of blobs.
        const body = await resp.json();
        jsonResponses.push({ url: u, body });
      } catch {
        // ignore
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Give the app some time to execute and fetch data.
    await page.waitForTimeout(Number(process.env.PAGE_SETTLE_MS || 8000));

    let selected = false;
    if (addressQuery) {
      const selectors = [
        'input[placeholder*="Адрес"]',
        'input[placeholder*="адрес"]',
        'input[placeholder*="Вулиц"]',
        'input[placeholder*="вулиц"]',
        'input[name*="address"]',
        'input[id*="address"]',
      ];

      for (const sel of selectors) {
        const h = await page.$(sel);
        if (!h) continue;
        try {
          await h.fill('');
          await h.type(addressQuery, { delay: 10 });
          await page.waitForTimeout(1000);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(Number(process.env.ADDRESS_SETTLE_MS || 5000));
          selected = true;
          break;
        } catch {
          // try next
        }
      }
    }

    const html = await page.content();
    return { html, jsonResponses, selected };
  } finally {
    await browser.close();
  }
}
