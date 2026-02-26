/**
 * scrape.js — run by GitHub Actions on a schedule
 *
 * Reads cruise URLs from the CRUISE_URLS environment variable (set as a
 * GitHub Secret), scrapes each one, and writes the results to
 * ../public/data/prices.json so the React app can load them.
 *
 * CRUISE_URLS format (set in GitHub Secrets):
 * [
 *   { "id": "cruise-1", "label": "Bahamas 7-Night", "url": "https://www.royalcaribbean.com/..." },
 *   { "id": "cruise-2", "label": "Caribbean 9-Night", "url": "https://www.royalcaribbean.com/..." }
 * ]
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'data', 'prices.json');

// ─── Scraper (same logic as server.js) ────────────────────────────────────────

async function scrapeCruise(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));

    const data = await page.evaluate(() => {
      const getText = (sel) => document.querySelector(sel)?.textContent?.trim() || null;

      const name =
        getText('h1') ||
        getText('[class*="sailingName"]') ||
        getText('[class*="cruise-name"]') ||
        document.title.replace(' | Royal Caribbean', '').trim();

      const ship =
        getText('[class*="shipName"]') ||
        getText('[class*="ship-name"]') ||
        getText('[data-testid="ship-name"]') ||
        null;

      const dateEl =
        document.querySelector('[class*="departureDate"]') ||
        document.querySelector('[class*="departure-date"]') ||
        document.querySelector('time');
      const departureDate = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || null;

      const durationMatch = document.body.innerText.match(/(\d+)\s*[–\-]\s*[Nn]ight/);
      const duration = durationMatch ? durationMatch[1] : null;

      const destination =
        getText('[class*="itinerary"]') ||
        getText('[class*="destination"]') ||
        null;

      const priceEls = [...document.querySelectorAll('*')].filter(el => {
        const text = el.textContent.trim();
        return /^\$[\d,]+$/.test(text) && el.children.length === 0;
      });

      const prices = {};
      for (const el of priceEls) {
        const val = parseFloat(el.textContent.replace(/[$,]/g, ''));
        if (!val || val < 200 || val > 30000) continue;
        const parent = el.closest('[class*="cabin"],[class*="stateroom"],[class*="room"],[class*="category"]');
        const label = parent?.querySelector('[class*="name"],[class*="type"],[class*="label"]')?.textContent?.toLowerCase() || '';
        if (label.includes('suite') && !prices.suite) prices.suite = val;
        else if (label.includes('balcon') && !prices.balcony) prices.balcony = val;
        else if ((label.includes('ocean') || label.includes('window')) && !prices.oceanview) prices.oceanview = val;
        else if ((label.includes('interior') || label.includes('inside')) && !prices.interior) prices.interior = val;
      }

      if (Object.keys(prices).length === 0) {
        const sorted = priceEls
          .map(el => parseFloat(el.textContent.replace(/[$,]/g, '')))
          .filter(v => v >= 200 && v <= 30000)
          .sort((a, b) => a - b);
        ['interior', 'oceanview', 'balcony', 'suite'].forEach((t, i) => {
          if (sorted[i]) prices[t] = sorted[i];
        });
      }

      return { name, ship, departureDate, duration, destination, prices };
    });

    await browser.close();

    if (data.departureDate) {
      const parsed = new Date(data.departureDate);
      if (!isNaN(parsed)) data.departureDate = parsed.toISOString().split('T')[0];
    }

    return { success: true, data };
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error(`Failed to scrape ${url}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Load cruise list from environment variable (set as GitHub Secret)
  let cruiseList = [];
  try {
    cruiseList = JSON.parse(process.env.CRUISE_URLS || '[]');
  } catch (e) {
    console.error('Invalid CRUISE_URLS env var — must be a JSON array');
    process.exit(1);
  }

  if (cruiseList.length === 0) {
    console.log('No cruise URLs configured. Add them as the CRUISE_URLS GitHub Secret.');
    process.exit(0);
  }

  // Load existing data so we can append to price history
  let existing = {};
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      const prev = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      for (const entry of prev) existing[entry.id] = entry;
    }
  } catch (e) {}

  const results = [];
  const timestamp = new Date().toISOString();

  for (const cruise of cruiseList) {
    console.log(`\nScraping: ${cruise.label || cruise.url}`);
    const result = await scrapeCruise(cruise.url);

    const prev = existing[cruise.id] || { history: [] };
    const history = prev.history || [];

    if (result.success) {
      // Append a price history entry for each stateroom type
      const entry = { timestamp, prices: result.data.prices };
      history.push(entry);

      results.push({
        id: cruise.id,
        label: cruise.label,
        url: cruise.url,
        lastScraped: timestamp,
        ...result.data,
        history,
      });
      console.log(`  ✅ Success — prices:`, result.data.prices);
    } else {
      // Keep previous data but record the failure
      results.push({
        ...(prev || {}),
        id: cruise.id,
        label: cruise.label,
        url: cruise.url,
        lastError: result.error,
        lastAttempt: timestamp,
        history,
      });
      console.log(`  ❌ Failed:`, result.error);
    }
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n✅ Wrote prices to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
