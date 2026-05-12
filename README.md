# 🚢 CruiseWatch — Royal Caribbean Price Tracker

A React web app to track Royal Caribbean cruise prices across all stateroom categories, with daily auto-scraping via GitHub Actions.

## ✨ Features

- **Watchlist** — Monitor unlimited cruises simultaneously
- **4 Stateroom Categories** — Interior 🛏️, Ocean View 🪟, Balcony 🌊, Suite 👑
- **Daily Auto-Scrape** — GitHub Actions scraper runs every day at 9 AM SGT
- **Price History** — Full historical log with auto vs manual source tracking
- **Price Alerts** — Visual alerts when prices drop to your target
- **Price Trends** — % change with up/down indicators
- **Departure Countdown** — Days until sailing
- **Manual Price Entry** — Override/supplement auto-scraped prices
- **Import / Export** — Backup and restore all your data as JSON
- **URL Auto-Fill** — Paste a Royal Caribbean checkout URL and ship, date, price fill automatically

---

## 🚀 Deploy in 5 Minutes (GitHub Pages)

### Step 1: Create a GitHub repo

1. Go to [github.com](https://github.com) and create a new **public** repository named `cruise-price-tracker`
2. Don't initialise with a README

### Step 2: Update homepage in package.json

Edit line 5 of `package.json`:
```json
"homepage": "https://YOUR_GITHUB_USERNAME.github.io/cruise-price-tracker"
```

### Step 3: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/cruise-price-tracker.git
git branch -M main
git push -u origin main
```

### Step 4: Enable GitHub Pages

1. Go to repo **Settings → Pages**
2. Source: **GitHub Actions**

The `deploy.yml` workflow will automatically build and deploy on every push to `main`.

### Step 5: Add cruise URLs for auto-scraping

1. Go to repo **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `CRUISE_URLS`
3. Value: JSON array of your cruise checkout URLs, e.g.:
```json
[
  {
    "id": "harmony-dec-2026",
    "label": "Harmony 7N Caribbean Dec 2026",
    "url": "https://www.royalcaribbean.com/checkout/guest-info?shipCode=HM&sailDate=2026-12-05&r0d=BALCONY&r0A=2199.00&..."
  }
]
```

The scraper runs daily at **9 AM Singapore time** and commits updated `public/data/prices.json`.

---

## 💻 Local Development

```bash
npm install
npm start        # Opens http://localhost:3000
npm run build    # Production build
npm run deploy   # Deploy to GitHub Pages
```

---

## 📖 How to Use

### Adding a cruise
1. Click **Add cruise**
2. Paste your Royal Caribbean checkout URL — ship, date, and price auto-fill
3. Set a Scraper ID that matches the `id` in your `CRUISE_URLS` secret
4. Click **Add to watchlist**

### Getting the checkout URL
1. Go to [royalcaribbean.com](https://www.royalcaribbean.com)
2. Search for a cruise → select cabin type → reach the Guest Info page
3. Copy the full URL from your browser address bar

### Recording prices manually
Expand a cruise card → use **Add today's prices** to log prices without the scraper.

### Setting price alerts
Expand a cruise card → enter target prices under **Price alerts** — the card highlights gold when the current price hits your target.

---

## 🔧 Project Structure

```
cruise-price-tracker/
├── src/
│   ├── App.js              # Main React app (all UI)
│   ├── index.js            # React entry point
│   ├── index.css           # Global styles
│   └── App.css             # App-specific styles
├── public/
│   ├── index.html          # HTML template
│   └── data/
│       └── prices.json     # Written by scraper daily
├── scraper/
│   ├── scrape.js           # Node.js price scraper
│   └── package.json        # Scraper dependencies (none — uses built-in https)
├── Backend/
│   ├── scrape.js           # Alternative backend scraper
│   └── package.json
├── .github/workflows/
│   ├── scrape-prices.yml   # Daily scrape job (9 AM SGT)
│   └── deploy.yml          # Auto-deploy to GitHub Pages on push
└── package.json            # React app dependencies
```

---

## ⚙️ How the Scraper Works

1. Reads the `CRUISE_URLS` GitHub secret (JSON array of `{id, label, url}` objects)
2. For each URL, fetches the Royal Caribbean page and tries to extract a live price from HTML JSON blobs
3. Falls back to the price encoded in the URL query string (`r0A` param)
4. Appends to price history only when the price changes
5. Commits `public/data/prices.json` back to the repo
6. The deployed React app fetches this file on load

---

## 💡 Pro Tips

- Start tracking **6–12 months** before your sailing date
- Set alerts **10–15% below** current prices
- **Wave Season** (Jan–Mar) typically has the best Royal Caribbean deals
- After booking, keep monitoring — Royal Caribbean allows repricing on some fare types

---

## ⚠️ Disclaimer

Not affiliated with Royal Caribbean International. Always verify prices directly with Royal Caribbean before booking.

## 📄 License

MIT
