# 🚢 Royal Caribbean Cruise Price Tracker

A comprehensive React web application to track Royal Caribbean cruise prices across different stateroom categories, monitor price changes over time, and set up price alerts.

![Royal Caribbean Price Tracker](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC?logo=tailwind-css)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

- **Multi-Cruise Tracking** — Monitor unlimited cruises simultaneously
- **Four Stateroom Categories** — Interior 🛏️, Ocean View 🪟, Balcony 🌊, Suite 👑
- **Price History** — Complete historical tracking with timestamps
- **Price Alerts** — Visual alerts when prices drop to target levels
- **Price Trends** — Percentage changes with color indicators
- **Departure Countdown** — Automatic countdown for upcoming cruises
- **Import/Export** — Backup and restore your data
- **Persistent Storage** — All data saved in browser localStorage

## 🚀 Deploy to GitHub Pages in 5 Minutes

### Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it `cruise-price-tracker`
3. Keep it **Public**
4. Don't initialize with README
5. Click "Create repository"

### Step 2: Update package.json

Edit `package.json` line 5:

```json
"homepage": "https://YOUR_GITHUB_USERNAME.github.io/cruise-price-tracker"
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

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

1. Go to repo **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **gh-pages** → **/(root)**
4. Click **Save**

### Step 5: Access Your Live App

After 2-5 minutes, visit:
```
https://YOUR_GITHUB_USERNAME.github.io/cruise-price-tracker
```

🎉 Done! Your app is live!

## 💻 Local Development

```bash
# Install
npm install

# Run locally
npm start          # Opens http://localhost:3000

# Build
npm run build

# Deploy
npm run deploy
```

## 📖 How to Use

### Adding a Cruise
1. Click **"Add Cruise"**
2. Enter cruise details (name, ship, date, duration, destination)
3. Optionally add initial prices
4. Click **"Add Cruise"** to save

### Tracking Prices
1. Enter new price in the input field
2. Click **"Update"** or press Enter
3. View price change indicators:
   - 🟢 Green ↓ = Price decreased
   - 🔴 Red ↑ = Price increased
   - Percentage shows % change

### Setting Price Alerts
1. Expand cruise details
2. Enter target prices for each stateroom
3. Get visual alerts when price ≤ target:
   - Green card border
   - 🔔 Bell icon
   - "Price Alert!" message

### Managing Data
- **Edit**: Click ✏️ to modify cruise
- **Delete**: Click 🗑️ to remove cruise
- **Export**: Backup all data to JSON file
- **Import**: Restore from JSON backup

## 💡 Pro Tips

### For Travelers
- Start tracking 6-12 months before sailing
- Update prices weekly
- Set alerts 10-15% below current prices
- Book when you hit your target
- Continue monitoring for repricing

### Best Times to Book
- **Wave Season** (Jan-Mar): Best deals
- **Last Minute** (60-90 days): Discounts on unsold inventory
- **Shoulder Season**: Better pricing outside peak times

## 🔧 Tech Stack

- React 18.2.0
- Tailwind CSS (via CDN)
- Lucide React icons
- localStorage for data
- GitHub Pages hosting
- GitHub Actions deployment

## 📱 Browser Support

✅ Chrome 90+ | Firefox 88+ | Safari 14+ | Edge 90+ | Mobile browsers

## 🔒 Privacy

- All data stored locally in your browser
- No servers, no tracking, no data collection
- Export/import for manual backups

## ⚠️ Disclaimer

Not affiliated with Royal Caribbean International. Verify prices directly with Royal Caribbean before booking.

## 📄 License

MIT License

---

**Made with ❤️ for cruise enthusiasts**

**Happy Cruising! 🚢⚓**
