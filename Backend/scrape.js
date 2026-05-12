/**
 * Royal Caribbean Live Price Scraper
 *
 * How it works:
 *   1. Reads CRUISE_URLS secret (JSON array of checkout URL objects)
 *   2. For each cruise URL, makes an HTTP request and parses the live price
 *   3. Writes updated prices.json back to public/data/prices.json
 *
 * Royal Caribbean checkout URLs contain live pricing data in query params.
 * The r0A param = total price (post-discount). We also try scraping the
 * HTML body for updated price values in case r0A is stale.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'data', 'prices.json');

const SHIP_NAMES = {
  AD:'Adventure of the Seas', AL:'Allure of the Seas', AN:'Anthem of the Seas',
  BR:'Brilliance of the Seas', EN:'Enchantment of the Seas', EX:'Explorer of the Seas',
  FR:'Freedom of the Seas',   GR:'Grandeur of the Seas',   HM:'Harmony of the Seas',
  IC:'Icon of the Seas',      ID:'Independence of the Seas',JW:'Jewel of the Seas',
  LB:'Liberty of the Seas',   MA:'Mariner of the Seas',    NV:'Navigator of the Seas',
  OA:'Oasis of the Seas',     OY:'Odyssey of the Seas',    OV:'Ovation of the Seas',
  QN:'Quantum of the Seas',   RD:'Radiance of the Seas',   RH:'Rhapsody of the Seas',
  SC:'Spectrum of the Seas',  SR:'Serenade of the Seas',   ST:'Star of the Seas',
  SY:'Symphony of the Seas',  UT:'Utopia of the Seas',     VI:'Vision of the Seas',
  VY:'Voyager of the Seas',   WN:'Wonder of the Seas',
};

const CABIN_MAP = {
  INTERIOR:'interior', OCEANVIEW:'oceanview', BALCONY:'balcony', SUITE:'suite',
  INSIDE:'interior',   OUTSIDE:'oceanview',   JUNIOR_SUITE:'suite',
};

// ── Parse metadata & initial price from checkout URL ──────────────────────────

function parseCheckoutUrl(rawUrl) {
  const u = new URL(rawUrl);
  const p = u.searchParams;

  const shipCode      = (p.get('shipCode') || '').toUpperCase();
  const sailDate      = p.get('sailDate') || '';
  const cabinRaw      = (p.get('r0d') || p.get('cabinClassType') || '').toUpperCase().trim();
  const stateroomType = CABIN_MAP[cabinRaw] || 'interior';
  const ship          = SHIP_NAMES[shipCode] || shipCode || null;
  const urlPrice      = p.get('r0A') ? parseFloat(p.get('r0A')) : null;
  const currency      = p.get('selectedCurrencyCode') || 'USD';

  let departureDate = sailDate;
  let friendlyDate  = '';
  if (sailDate) {
    const d = new Date(sailDate);
    if (!isNaN(d)) {
      departureDate = d.toISOString().split('T')[0];
      friendlyDate  = d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    }
  }

  let duration = null;
  const pkgMatch = (p.get('packageCode') || '').match(/[A-Z]{2}(\d+)[A-Z]/);
  if (pkgMatch) duration = String(parseInt(pkgMatch[1]));
  const r0fMatch = (p.get('r0f') || '').match(/^(\d+)N$/i);
  if (!duration && r0fMatch) duration = r0fMatch[1];

  const name = ship && friendlyDate ? `${ship} — ${friendlyDate}` : null;

  return { name, ship, shipCode, departureDate, duration, currency, stateroomType, urlPrice };
}

// ── Fetch page HTML with retries ──────────────────────────────────────────────

function fetchHtml(rawUrl, attempt = 0) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control':   'no-cache',
        'Pragma':          'no-cache',
      },
    };
    https.get(rawUrl, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchHtml(res.headers.location, attempt));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', (err) => {
      if (attempt < 2) {
        console.log(`  Retry ${attempt + 1}…`);
        setTimeout(() => resolve(fetchHtml(rawUrl, attempt + 1)), 3000);
      } else {
        reject(err);
      }
    });
  });
}

// ── Extract live price from page HTML ────────────────────────────────────────
// Royal Caribbean embeds price data in JSON blobs inside <script> tags.
// We look for the most reliable patterns first.

function extractPriceFromHtml(html) {
  const patterns = [
    // JSON data blobs
    /"totalPrice"\s*:\s*([\d.]+)/,
    /"grandTotal"\s*:\s*([\d.]+)/,
    /"totalFare"\s*:\s*([\d.]+)/,
    /"fareAmount"\s*:\s*([\d.]+)/,
    /"price"\s*:\s*([\d.]+)/,
    // Rendered text patterns
    /\$\s*([\d,]+\.?\d*)\s*(?:USD|total|per person)?/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      // Sanity check: cruise prices are typically $200–$100k
      if (price >= 200 && price <= 100000) {
        return price;
      }
    }
  }
  return null;
}

// ── Process one cruise entry ──────────────────────────────────────────────────

async function processCruise(entry) {
  const { url, label, id } = entry;
  console.log(`\n── ${label || id}`);
  console.log(`   ${url.slice(0, 80)}…`);

  if (!url.includes('royalcaribbean.com')) {
    console.log('   ⚠️  Not a Royal Caribbean URL — skipping');
    return { success: false, error: 'Not a Royal Caribbean URL' };
  }

  const meta = parseCheckoutUrl(url);
  console.log(`   Ship: ${meta.ship}, Date: ${meta.departureDate}, Type: ${meta.stateroomType}, Currency: ${meta.currency}`);

  // Step 1: try fetching live page for a fresh price
  let livePrice = null;
  try {
    console.log('   Fetching live page…');
    const html = await fetchHtml(url);

    // Also try to extract fresh r0A from any redirect URL embedded in page
    const r0aMatch = html.match(/[?&]r0A=([0-9.]+)/);
    if (r0aMatch) {
      const p = parseFloat(r0aMatch[1]);
      if (p >= 200 && p <= 100000) livePrice = p;
    }

    if (!livePrice) livePrice = extractPriceFromHtml(html);

    if (livePrice) {
      console.log(`   ✅ Live price: ${meta.currency} ${livePrice}`);
    } else {
      console.log('   ⚠️  Could not extract price from page body');
    }
  } catch (err) {
    console.log(`   ❌ Fetch failed: ${err.message}`);
  }

  // Step 2: fall back to URL-encoded price
  const price = livePrice ?? meta.urlPrice;

  if (price) {
    if (!livePrice && meta.urlPrice) {
      console.log(`   ↩️  Using URL-encoded price as fallback: ${meta.currency} ${price}`);
    }
    return {
      success: true,
      data: {
        ...meta,
        price,
        prices: { [meta.stateroomType]: price },
        source: livePrice ? 'live' : 'url-fallback',
      },
    };
  }

  console.log('   ❌ No price found');
  return { success: false, error: 'No price found in page or URL' };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // CRUISE_URLS secret: JSON array of objects
  // [{ "id": "cruise1", "label": "Harmony 7N Caribbean", "url": "https://www.royalcaribbean.com/checkout/guest-info?..." }]
  let cruiseList = [];
  try {
    cruiseList = JSON.parse(process.env.CRUISE_URLS || '[]');
  } catch {
    console.error('❌ CRUISE_URLS is not valid JSON. Set it as a GitHub Actions secret.');
    process.exit(1);
  }

  if (!Array.isArray(cruiseList) || cruiseList.length === 0) {
    console.log('ℹ️  No cruise URLs configured. Add them to the CRUISE_URLS secret.');
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    if (!fs.existsSync(OUTPUT_FILE)) fs.writeFileSync(OUTPUT_FILE, '[]');
    process.exit(0);
  }

  // Load existing data to preserve history
  let existing = {};
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      const prev = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      for (const e of prev) existing[e.id] = e;
    }
  } catch {}

  const results = [];
  const timestamp = new Date().toISOString();

  for (const entry of cruiseList) {
    if (!entry.id || !entry.url) {
      console.warn('⚠️  Skipping entry missing id or url:', entry);
      continue;
    }

    const result = await processCruise(entry);
    const prev   = existing[entry.id] || {};
    const history = [...(prev.history || [])];

    if (result.success) {
      const { data } = result;
      // Append to history only if price actually changed (or first entry)
      const lastEntry = history[history.length - 1];
      const lastPrice = lastEntry?.prices?.[data.stateroomType];
      if (!lastPrice || lastPrice !== data.price) {
        history.push({ timestamp, prices: data.prices, source: data.source });
      }
      results.push({
        id:            entry.id,
        label:         entry.label || data.name || entry.id,
        url:           entry.url,
        name:          data.name   || prev.name   || entry.label,
        ship:          data.ship   || prev.ship,
        departureDate: data.departureDate || prev.departureDate,
        duration:      data.duration      || prev.duration,
        currency:      data.currency      || prev.currency || 'USD',
        stateroomType: data.stateroomType,
        prices:        { ...(prev.prices || {}), ...data.prices },
        lastScraped:   timestamp,
        source:        data.source,
        history,
      });
    } else {
      // Keep existing data, just record the failed attempt
      results.push({
        ...(prev || {}),
        id:          entry.id,
        label:       entry.label || prev.label || entry.id,
        url:         entry.url,
        lastAttempt: timestamp,
        lastError:   result.error,
        history,
      });
    }

    // Polite delay between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n✅ Done — wrote ${results.length} cruise(s) to prices.json`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
