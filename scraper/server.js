/**
 * Royal Caribbean Price Scraper - Backend Proxy Server
 * 
 * Run with: node server.js
 * Deploy free on: Render.com, Railway.app, or Fly.io
 * 
 * Endpoints:
 *   POST /api/scrape-url     - Scrape a single Royal Caribbean URL
 *   GET  /api/prices         - Get all tracked prices
 *   POST /api/track          - Add a cruise URL to auto-track
 *   DELETE /api/track/:id    - Remove a tracked cruise
 */

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'tracked-cruises.json');

app.use(cors({ origin: '*' })); // In production, restrict to your GitHub Pages domain
app.use(express.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadTracked() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {}
  return [];
}

function saveTracked(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ─── Core Scraper ─────────────────────────────────────────────────────────────

async function scrapeRoyalCaribbeanUrl(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // Mimic a real browser to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });

    console.log(`Scraping: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

    // Wait for price elements to load
    await page.waitForSelector('body', { timeout: 10000 });

    // Give JS time to render dynamic content
    await new Promise(r => setTimeout(r, 3000));

    const data = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : null;
      };

      const getAllText = (selector) =>
        [...document.querySelectorAll(selector)].map(el => el.textContent.trim());

      // ── Cruise Name ──
      const name =
        getText('h1') ||
        getText('[class*="sailingName"]') ||
        getText('[class*="cruise-name"]') ||
        getText('[class*="heading"]') ||
        document.title.replace(' | Royal Caribbean', '').trim();

      // ── Ship ──
      const ship =
        getText('[class*="shipName"]') ||
        getText('[class*="ship-name"]') ||
        getText('[data-testid="ship-name"]') ||
        (() => {
          const labels = document.querySelectorAll('*');
          for (const el of labels) {
            if (el.textContent.includes('Ship:') || el.textContent.includes('Vessel:')) {
              return el.nextElementSibling?.textContent?.trim() || null;
            }
          }
          return null;
        })();

      // ── Departure Date ──
      const dateEl =
        document.querySelector('[class*="departureDate"]') ||
        document.querySelector('[class*="departure-date"]') ||
        document.querySelector('[data-testid="departure-date"]') ||
        document.querySelector('time');

      const departureDate = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || null;

      // ── Duration ──
      const durationMatch = document.body.innerText.match(/(\d+)\s*[–\-]\s*[Nn]ight/);
      const duration = durationMatch ? durationMatch[1] : null;

      // ── Destination ──
      const destination =
        getText('[class*="itinerary"]') ||
        getText('[class*="destination"]') ||
        getText('[class*="ports"]') ||
        null;

      // ── Prices ──
      // Royal Caribbean uses different class names — we look for price patterns
      const priceEls = [...document.querySelectorAll('*')].filter(el => {
        const text = el.textContent.trim();
        return /^\$[\d,]+$/.test(text) && el.children.length === 0;
      });

      const prices = {};
      const priceTexts = priceEls.map(el => {
        const val = parseFloat(el.textContent.replace(/[$,]/g, ''));
        // Try to find room type from nearby elements
        const parent = el.closest('[class*="cabin"], [class*="stateroom"], [class*="room"], [class*="category"]');
        const label = parent?.querySelector('[class*="name"], [class*="type"], [class*="label"]')?.textContent?.toLowerCase() || '';

        return { val, label, el };
      });

      // Map to our stateroom categories
      for (const { val, label } of priceTexts) {
        if (!val || val < 100 || val > 50000) continue;
        if (label.includes('suite')) prices.suite = prices.suite || val;
        else if (label.includes('balcon')) prices.balcony = prices.balcony || val;
        else if (label.includes('ocean') || label.includes('window')) prices.oceanview = prices.oceanview || val;
        else if (label.includes('interior') || label.includes('inside')) prices.interior = prices.interior || val;
      }

      // Fallback: assign cheapest prices in order if labels didn't match
      if (Object.keys(prices).length === 0) {
        const sorted = priceTexts
          .map(p => p.val)
          .filter(v => v >= 200 && v <= 30000)
          .sort((a, b) => a - b);

        const types = ['interior', 'oceanview', 'balcony', 'suite'];
        sorted.slice(0, 4).forEach((price, i) => {
          prices[types[i]] = price;
        });
      }

      return { name, ship, departureDate, duration, destination, prices };
    });

    await browser.close();

    // Normalize departure date to YYYY-MM-DD
    if (data.departureDate) {
      const parsed = new Date(data.departureDate);
      if (!isNaN(parsed)) {
        data.departureDate = parsed.toISOString().split('T')[0];
      }
    }

    return { success: true, data, url, scrapedAt: new Date().toISOString() };

  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    console.error('Scrape error:', error.message);
    return { success: false, error: error.message, url };
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Scrape a URL on demand (called when user pastes a URL in the React app)
app.post('/api/scrape-url', async (req, res) => {
  const { url } = req.body;

  if (!url || !url.includes('royalcaribbean.com')) {
    return res.status(400).json({ error: 'Please provide a valid Royal Caribbean URL' });
  }

  const result = await scrapeRoyalCaribbeanUrl(url);
  res.json(result);
});

// Get all currently tracked cruise prices
app.get('/api/prices', (req, res) => {
  res.json(loadTracked());
});

// Add a cruise URL to the auto-tracked list
app.post('/api/track', async (req, res) => {
  const { url, label } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const tracked = loadTracked();
  const id = Date.now().toString();
  tracked.push({ id, url, label: label || url, addedAt: new Date().toISOString(), history: [] });
  saveTracked(tracked);

  res.json({ success: true, id });
});

// Remove a tracked cruise
app.delete('/api/track/:id', (req, res) => {
  const tracked = loadTracked().filter(t => t.id !== req.params.id);
  saveTracked(tracked);
  res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`🚢 Royal Caribbean scraper server running on http://localhost:${PORT}`);
});
