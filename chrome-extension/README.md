# 🌌 Galaxy IQ Scraper - Chrome Extension

One-click scraper for Galaxy IQ products that accumulates data from multiple pages.

## ✨ Features

- 🔄 **One-Click Scraping** - Click the floating button or extension icon to scrape
- 📦 **Accumulate Data** - Scrape multiple pages, all products stored together
- 📥 **Download All** - Export all scraped products as one JSON file
- 🎯 **Auto-Detect** - Automatically shows scrape button on Galaxy IQ pages
- 🧹 **Clear Data** - Reset and start fresh anytime

## 📦 Installation

### Method 1: Load Unpacked Extension (Recommended)

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - Or click the puzzle icon → "Manage Extensions"

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `chrome-extension` folder from this project

4. **Done!** 
   - You should see "Galaxy IQ Scraper" in your extensions
   - Pin it to the toolbar for easy access

### Method 2: Convert Icons (If Needed)

If you see icon errors, convert the SVG icons to PNG:
- Use an online tool like https://cloudconvert.com/svg-to-png
- Convert icon16.svg → icon16.png (16x16)
- Convert icon48.svg → icon48.png (48x48)
- Convert icon128.svg → icon128.png (128x128)

## 🚀 Usage

### Quick Start

1. **Navigate to Galaxy IQ**
   - Go to any Galaxy IQ category page (e.g., CPUs, GPUs)
   - Pass Cloudflare protection if needed

2. **Scrape Page**
   - Click the floating "Scrape Page" button at bottom-right
   - OR click the extension icon and press "Scrape This Page"

3. **Navigate to Next Category**
   - Go to another Galaxy IQ category (e.g., RAM)
   - Click "Scrape Page" again
   - Data accumulates automatically!

4. **Download All Data**
   - Click extension icon
   - Press "Download All JSON"
   - You'll get `galaxyiq_scraped_data.json` with all products

5. **Import to Backend**
   - Copy the JSON content
   - Paste into `backend/galaxyiq_scraped_data.json`
   - Run: `python backend/import_galaxyiq_manual.py`

### Example Workflow

```
Visit: https://galaxyiq.com/cpu
↓
Click "Scrape Page" → ✅ Scraped 15 products

Visit: https://galaxyiq.com/gpu
↓
Click "Scrape Page" → ✅ Scraped 23 products (Total: 38)

Visit: https://galaxyiq.com/ram
↓
Click "Scrape Page" → ✅ Scraped 12 products (Total: 50)

Click "Download All JSON" → 📥 galaxyiq_scraped_data.json
```

## 🎨 Extension UI

The extension popup shows:
- 📦 Total Products count
- 📄 Pages scraped count
- 🔄 Scrape This Page button
- 📥 Download All JSON button (enabled when products > 0)
- 🗑️ Clear All Data button

## ⚙️ How It Works

### Scraper Logic

The extension:
1. Finds all product cards on the page
2. Extracts: title, price, image, URL, stock status
3. Auto-detects category from URL
4. Uses image proxy (images.weserv.nl) for Galaxy IQ images
5. Stores products in memory (resets when extension closes)

### Category Detection

Auto-detects categories from URL:
- `/cpu` → CPU
- `/gpu` → GPU
- `/motherboard` → Motherboards
- `/ram` → RAM
- `/storage` → Storage
- And more...

## 🔒 Privacy

- ✅ No data sent to external servers
- ✅ All scraping happens locally in your browser
- ✅ Data stored in memory only (not persistent)
- ✅ You control when to download

## 🐛 Troubleshooting

### Extension Not Working

- Make sure you're on `galaxyiq.com`
- Check if Developer Mode is enabled
- Try reloading the extension

### No Products Found

- Check if the page has loaded completely
- Pass Cloudflare protection first
- Make sure you're on a product listing page

### Floating Button Not Appearing

- Refresh the page after installing extension
- Check browser console for errors

## 📝 Notes

- Data **resets when you close the popup**
- This is intentional for privacy and simplicity
- Download your JSON before closing!

## 🎯 Tips

- Scrape all 12 Galaxy IQ categories at once
- Keep the extension popup open while scraping
- Download immediately after scraping all pages

## 🔄 Updates

To update the extension after code changes:
1. Go to `chrome://extensions/`
2. Click the refresh icon on the extension card

---

**Made with 💜 for NexusPC**
