# 🚢 Cruise Price Tracker — Setup Guide

## What's been built

Three systems work together to automatically track Royal Caribbean prices:

| Feature | What it does |
|---|---|
| **URL paste** | Paste a cruise URL when adding a cruise → prices auto-fill instantly (requires backend) |
| **Backend scraper** | Node.js/Puppeteer server that scrapes RC pages on demand |
| **GitHub Actions** | Runs the scraper 3× daily, commits updated prices into your repo automatically |

---

## Step 1 — Fix GitHub Pages deployment

The repo now has exactly two correct workflow files. Delete these if they still exist in your repo:
- `.github/workflows/static.yml`
- `.github/workflows/jekyll-gh-pages.yml`

Keep only:
- `.github/workflows/deploy.yml` — builds the React app and deploys to GitHub Pages
- `.github/workflows/scrape-prices.yml` — auto-scrapes prices on a schedule

---

## Step 2 — Set up GitHub Actions auto-scraping (free)

1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `CRUISE_URLS`
4. Value: a JSON array of your cruise URLs:

```json
[
  {
    "id": "cruise-1",
    "label": "7-Night Bahamas - Wonder of the Seas",
    "url": "https://www.royalcaribbean.com/cruises/..."
  },
  {
    "id": "cruise-2",
    "label": "9-Night Caribbean - Harmony of the Seas",
    "url": "https://www.royalcaribbean.com/cruises/..."
  }
]
```

5. Save the secret.

GitHub Actions will scrape these URLs at **6am, 12pm, and 6pm UTC** every day, then commit updated prices to `public/data/prices.json`. Your app loads that file on startup and automatically merges the fresh prices into any matching cruise.

To trigger a manual scrape any time: go to **Actions → Scrape Royal Caribbean Prices → Run workflow**.

---

## Step 3 — (Optional) Backend server for instant URL paste

This lets you paste a URL in the **Add Cruise** form and have all the details fill in immediately, rather than waiting for the next scheduled scrape.

### Deploy for free on Render.com

1. Sign in to [render.com](https://render.com) with GitHub
2. Click **New → Web Service** and connect your repo
3. Render will detect `render.yaml` and auto-configure everything
4. Deploy — you'll get a URL like `https://cruise-price-scraper.onrender.com`

### Connect the server to your React app

Add this to a `.env` file in the root of your project:

```
REACT_APP_SCRAPER_URL=https://your-app-name.onrender.com
```

Then commit, push, and let GitHub Actions redeploy. Now the **Fetch** button in the Add Cruise form calls your server and fills in ship name, dates, destination, and all prices automatically.

> **Note:** Render's free tier spins down after 15 min of inactivity. The first request may take ~30 seconds. Upgrade to their $7/mo plan for always-on.

### Run locally during development

```bash
# Terminal 1 — start backend
cd scraper
npm install
node server.js

# Terminal 2 — start React app pointed at local backend
REACT_APP_SCRAPER_URL=http://localhost:3001 npm start
```

---

## How it all fits together

```
User pastes URL in form
        ↓
  Backend server scrapes RC page (Puppeteer)
        ↓
  Returns: name, ship, date, prices
        ↓
  Form auto-fills → user saves cruise
        ↓
  GitHub Actions runs 3× daily
        ↓
  scrape.js fetches all saved cruise URLs
        ↓
  Writes public/data/prices.json
        ↓
  GitHub Actions commits & pushes
        ↓
  Deploy workflow rebuilds app
        ↓
  App loads fresh prices on next visit ✅
```

---

## File structure

```
├── src/App.js                        ← React app (URL paste + auto-price merging)
├── scraper/
│   ├── server.js                     ← Express API server (URL paste backend)
│   ├── scrape.js                     ← CLI script run by GitHub Actions
│   └── package.json
├── public/data/prices.json           ← Written by Actions, read by React app
├── .github/workflows/
│   ├── deploy.yml                    ← Builds + deploys React to GitHub Pages
│   └── scrape-prices.yml             ← Scrapes prices 3× daily
└── render.yaml                       ← One-click Render.com backend deploy config
```

---

## Troubleshooting

**Scraper returns empty or wrong prices**
Royal Caribbean's site is heavily JavaScript-rendered and changes its class names. If scraping fails, open DevTools on a cruise page, find the price elements, and update the selectors in `scraper/scrape.js`.

**GitHub Actions workflow fails**
Check the Actions log. Most common causes:
- `CRUISE_URLS` secret is missing or invalid JSON
- Puppeteer can't find Chrome (the workflow installs required Linux libraries — make sure those `apt-get` lines are intact)

**CORS error when calling the backend**
In `scraper/server.js`, replace `origin: '*'` with your exact domain:
```js
app.use(cors({ origin: 'https://YOUR-USERNAME.github.io' }));
```
