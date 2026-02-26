const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'data', 'prices.json');

const SHIP_NAMES = {
  AD:'Adventure of the Seas',AL:'Allure of the Seas',AN:'Anthem of the Seas',
  BR:'Brilliance of the Seas',EN:'Enchantment of the Seas',EX:'Explorer of the Seas',
  FR:'Freedom of the Seas',GR:'Grandeur of the Seas',HM:'Harmony of the Seas',
  IC:'Icon of the Seas',ID:'Independence of the Seas',JW:'Jewel of the Seas',
  LB:'Liberty of the Seas',MA:'Mariner of the Seas',NV:'Navigator of the Seas',
  OA:'Oasis of the Seas',OY:'Odyssey of the Seas',OV:'Ovation of the Seas',
  QN:'Quantum of the Seas',RD:'Radiance of the Seas',RH:'Rhapsody of the Seas',
  SC:'Spectrum of the Seas',SR:'Serenade of the Seas',ST:'Star of the Seas',
  SY:'Symphony of the Seas',UT:'Utopia of the Seas',VI:'Vision of the Seas',
  VY:'Voyager of the Seas',WN:'Wonder of the Seas',
};

const CABIN_TYPE_MAP = {
  INTERIOR:'interior',INSIDE:'interior',OUTSIDE:'oceanview',OCEANVIEW:'oceanview',
  OCEAN_VIEW:'oceanview',BALCONY:'balcony',DELUXE:'balcony',
  SUITE:'suite',GRAND_SUITE:'suite',SKY_SUITE:'suite',
};

function parseCheckoutUrl(rawUrl) {
  const url = new URL(rawUrl);
  const p = url.searchParams;

  const shipCode = (p.get('shipCode') || '').toUpperCase();
  const sailDate = p.get('sailDate') || '';
  const cabinClassRaw = (p.get('cabinClassType') || p.get('r0d') || '').toUpperCase();
  const adults = parseInt(p.get('r0a') || '2');
  const stateroomType = CABIN_TYPE_MAP[cabinClassRaw] || 'interior';
  const ship = SHIP_NAMES[shipCode] || shipCode;

  const priceRaw = p.get('r0j');
  const pricePerPerson = priceRaw ? parseFloat(priceRaw) : null;
  const totalPrice = pricePerPerson ? Math.round(pricePerPerson * adults * 100) / 100 : null;

  let departureDate = sailDate;
  let name = null;
  if (sailDate) {
    const d = new Date(sailDate);
    if (!isNaN(d)) {
      departureDate = d.toISOString().split('T')[0];
      name = `${ship} — ${d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}`;
    }
  }

  let duration = null;
  const pkgMatch = (p.get('packageCode') || '').match(/[A-Z]{2}(\d+)[A-Z]/);
  if (pkgMatch) duration = pkgMatch[1];
  const r0fMatch = (p.get('r0f') || '').match(/^(\d+)N$/i);
  if (!duration && r0fMatch) duration = r0fMatch[1];

  const prices = {};
  if (totalPrice) prices[stateroomType] = totalPrice;

  return { name, ship, shipCode, departureDate, duration: duration?.toString() || null, stateroomType, pricePerPerson, totalPrice, adults, prices };
}

function fetchUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };
    https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location, redirectCount + 1));
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

async function processCruise(cruise) {
  console.log(`\nProcessing: ${cruise.label || cruise.url}`);

  if (!cruise.url.includes('/checkout/guest-info')) {
    console.log('  ⚠️  Not a checkout URL — skipping');
    return { success: false, error: 'Not a checkout URL' };
  }

  const parsed = parseCheckoutUrl(cruise.url);
  console.log(`  Ship: ${parsed.ship}, Date: ${parsed.departureDate}, Type: ${parsed.stateroomType}`);

  if (parsed.totalPrice) {
    console.log(`  ✅ Price from URL: $${parsed.totalPrice} (${parsed.adults} guests)`);
    return { success: true, data: parsed };
  }

  console.log('  No price in URL params, fetching live page...');
  try {
    const body = await fetchUrl(cruise.url);
    const patterns = [
      /"totalPrice"\s*:\s*([\d.]+)/,
      /"grandTotal"\s*:\s*([\d.]+)/,
      /"totalFare"\s*:\s*([\d.]+)/,
      /"price"\s*:\s*([\d.]+)/,
    ];
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        const price = parseFloat(match[1]);
        if (price > 200 && price < 100000) {
          parsed.prices[parsed.stateroomType] = price;
          parsed.totalPrice = price;
          console.log(`  ✅ Price from page: $${price}`);
          return { success: true, data: parsed };
        }
      }
    }
    console.log('  ⚠️  Could not find price');
    return { success: true, data: { ...parsed, prices: {} } };
  } catch (err) {
    console.log(`  ❌ Fetch failed: ${err.message}`);
    return { success: true, data: { ...parsed, prices: {} } };
  }
}

async function main() {
  let cruiseList = [];
  try {
    cruiseList = JSON.parse(process.env.CRUISE_URLS || '[]');
  } catch {
    console.error('❌ Invalid CRUISE_URLS — must be a JSON array');
    process.exit(1);
  }

  if (cruiseList.length === 0) {
    console.log('No cruise URLs configured.');
    process.exit(0);
  }

  let existing = {};
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      for (const e of JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))) {
        existing[e.id] = e;
      }
    }
  } catch {}

  const results = [];
  const timestamp = new Date().toISOString();

  for (const cruise of cruiseList) {
    const result = await processCruise(cruise);
    const prev = existing[cruise.id] || { history: [] };
    const history = [...(prev.history || [])];

    if (result.success && Object.keys(result.data.prices).length > 0) {
      history.push({ timestamp, prices: result.data.prices });
      results.push({ id: cruise.id, label: cruise.label, url: cruise.url, lastScraped: timestamp, ...result.data, history });
    } else {
      results.push({ ...(prev || {}), id: cruise.id, label: cruise.label, url: cruise.url, lastAttempt: timestamp, lastError: result.error || 'No price found', history });
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n✅ Wrote ${results.length} cruise(s) to ${OUTPUT_FILE}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
