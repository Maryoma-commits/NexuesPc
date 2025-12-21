# 🤖 AI Agent Memory - NexusPC Project

## 📊 Project Overview
**NexusPC** - Iraqi PC Component Price Aggregator  
**Live URL:** https://nexues-pc.vercel.app  
**Tech Stack:** React 19 + TypeScript + Vite (Frontend), Python FastAPI (Backend)

---

## 🏗️ Architecture

### Frontend (Vercel - Auto-deploy)
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite 6.2.0
- **Deployment:** Vercel (auto-deploys on git push)
- **Analytics:** Vercel Speed Insights + Web Analytics
- **UI Library:** Lucide React icons

### Key Frontend Components:
- `App.tsx` - Main app with product browsing & filtering
- `PCBuilder.tsx` - PC Builder with lazy loading (20 products/page) & global store filter
- `ProductCard.tsx` - Product cards with retailer logos
- `CategoryNav.tsx` - Category navigation (14 categories)
- `Sidebar.tsx` - Store filters & price range
- `FavoritesPanel.tsx` - Save favorite products
- `Navbar.tsx` - Top navigation with search
- `ThemeToggle.tsx` - Dark/Light mode
- `FavoriteButton.tsx` - Add to favorites

### Backend (Local PC)
- Python FastAPI
- Web scrapers for 9 retailers
- Admin dashboard: `python main.py admin`
- Products stored in: `public/data/products.json`

---

## 🛒 Retailers (9 Total)

### Automated Scrapers (8):
1. **GlobalIraq** - Shopify API
2. **Alityan** - Shopify API
3. **Kolshzin** - WooCommerce HTML scraping
4. **3D-Iraq** - Shopify API
5. **JokerCenter** - WooCommerce HTML (SSL issues - needs fix)
6. **Almanjam** - WooCommerce HTML
7. **SpNIQ** - Custom API (https://api.spniq.com/categories)
8. **Altajit** - Shopify API

### Manual Only (1):
9. **Galaxy IQ** - Browser scraping only (Cloudflare protection)
   - Script: `tmp_rovodev_galaxyiq_browser_scraper.js`
   - Import: `backend/import_galaxyiq_manual.py`
   - Images: Use proxy via `images.weserv.nl`
   - Categories: Case, Cooler, CPU, GPU, Headsets, Keyboard, Laptops, Monitors, Motherboards, Mouse, Power Supply, RAM, Storage (12 total)

---

## 🔒 Important Safety Features

### Manual Retailer Protection
- **Location:** `backend/main.py` line ~240
- **List:** `manual_retailers = ["galaxyiq"]`
- **Purpose:** Prevents Galaxy IQ from being deleted during "Scrape All"
- **How:** Adds manual retailers back to scrape data before save

### Smart Merge Logic
- **Function:** `save_all_products_to_frontend()`
- **Mode:** Always use `merge=True` (not merge=False!)
- **Safety Check:** If scraper returns 0 products but existing data > 0 → Keep existing
- **Preserves:** User specs, manual categories, compatibility fields

### Product Data Preservation
- **Function:** `preserve_compatibility_specs()`
- **Preserves:** `compatibility`, `userEditedFields`, manual category changes
- **Updates:** `price`, `old_price`, `in_stock`, `image`, `raw_price`

---

## 🐛 Known Bugs Fixed

### Galaxy IQ Deletion Bug (FIXED)
- **Issue:** "Scrape All" was deleting Galaxy IQ products
- **Cause:** `scrape_and_save_all_sites()` used `merge=False`
- **Fix:** Changed to `merge=True` + added manual retailer protection

### SpNIQ Link Bug (FIXED)
- **Issue:** Product links were fake/broken
- **Cause:** Missing URL field in API, wrong ID generation
- **Fix:** Build URLs from `_id` + slugified title: `https://spniq.com/product/{title_slug}_{_id}`
- **Also Fixed:** Was using "kolshzin" prefix instead of proper ID

### SpNIQ Price Bug (FIXED)
- **Issue:** `price` variable not defined
- **Fix:** Use `price_data['numeric_value']` and `str(raw_price)`

### Kolshzin Price Bug (FIXED)
- Same issue as SpNIQ, fixed with proper price parsing

---

## 📂 Important Files

### Frontend
- `App.tsx` - Main application with Analytics components
- `components/PCBuilder.tsx` - PC Builder with lazy loading & global store filter
- `components/CategoryNav.tsx` - Category navigation (Laptop RAM in More dropdown)
- `public/data/products.json` - Product database (5,000+ products)
- `public/WebSitesLogo/` - Retailer logos (including galaxyiq.png)

### Backend
- `backend/main.py` - FastAPI server + CLI + merge logic
- `backend/scraper.py` - Multi-retailer scraper (~3,200 lines, NO Galaxy IQ code)
- `backend/import_galaxyiq_manual.py` - Galaxy IQ smart merge import
- `backend/galaxyiq_scraped_data.json` - Temp file for manual scraping
- `backend/price_utils.py` - Price parsing utilities

### Temp Files (Don't commit)
- `tmp_rovodev_galaxyiq_browser_scraper.js` - Browser console scraper for Galaxy IQ
- `1.png` - Temporary screenshot (in .gitignore)

---

## 🎨 Key Features

### PC Builder
- Lazy loading (20 products/page) with infinite scroll
- Global store filter (persists across categories)
- Socket/RAM type category-specific filters
- Compatibility warnings (combined with price in one bar)
- "View Product" button on each card
- Click card to select component

### Product Cards
- Retailer logos (not just text)
- "View" button with external link icon
- Proper sizing for all logos (Galaxy IQ: h-6, max-w-20)

### Admin Dashboard
- Galaxy IQ shows "📝 Manual Scrape" badge (not clickable)
- Other retailers have "Scrape Now" button
- Bulk operations preserve manual edits
- Category list includes: Fans, Thermals, Laptops

---

## 🚀 Deployment Workflow

### Push Changes to Production
```bash
git add .
git commit -m "description"
git push
```
→ Vercel auto-deploys in 1-2 minutes

### Update Galaxy IQ Products
1. Open Galaxy IQ category in browser
2. Pass Cloudflare check
3. Run browser scraper script in console
4. Copy JSON (without brackets)
5. Paste into `backend/galaxyiq_scraped_data.json` between `[` and `]`
6. Run: `python backend/import_galaxyiq_manual.py`
7. Push to GitHub

---

## 🚨 Critical Rules

### NEVER Do:
1. ❌ Use `merge=False` in `scrape_and_save_all_sites()` (line 466)
2. ❌ Remove "galaxyiq" from `manual_retailers` list
3. ❌ Add Galaxy IQ functions back to `scraper.py`
4. ❌ Click "Scrape" on Galaxy IQ in admin (returns error, but safe)
5. ❌ Import Galaxy IQ with only partial products (will keep + add, not replace)

### ALWAYS Do:
1. ✅ Test locally before pushing to production
2. ✅ Use smart merge import for Galaxy IQ
3. ✅ Check that manual retailers are preserved after "Scrape All"
4. ✅ Write descriptive commit messages
5. ✅ Update this AGENTS.md when making major changes

---

## 📝 Recent Major Changes

### 2025-12-21
- JokerCenter SSL issue resolved (fixed by JokerCenter itself)

### 2025-12-19

### Vercel Integration
- Added Speed Insights (`@vercel/speed-insights`)
- Added Web Analytics (`@vercel/analytics`)
- Both components in App.tsx

### Galaxy IQ Complete Overhaul
- Removed from auto-scraper completely
- Created browser-based manual scraping system
- Added image proxy support (images.weserv.nl)
- Added stock detection ("إنتهى من المخزن")
- Smart merge import preserves existing products
- Protected from deletion during "Scrape All"

### SpNIQ Fixes
- Fixed product links (now use real URLs with _id from API)
- Fixed ID generation (was using "kolshzin" prefix)
- Fixed price parsing (undefined variables)
- Now fully functional with 269+ products

### PC Builder Improvements
- Added lazy loading with infinite scroll (20 products/page)
- Added global store filter (not just per-category)
- Moved Laptop RAM from RAM dropdown to More dropdown
- Combined warning bar with price total (saved vertical space)

---

## 🔢 Current Stats (Last Updated: 2025-12-21 03:44 AM)
- **Total Products:** 6,632
- **Retailers:** 9 (8 automated + 1 manual)
- **Categories:** 14 main (GPU, CPU, RAM, Motherboards, Storage, PSU, Cooler, Case, Monitor, Laptop, Mouse, Keyboard, Headset, Other) + subcategories (Fans, Thermals, Laptop RAM, Monitors, Laptops, Headsets)
- **Deployments:** Auto-deploy via Vercel on git push
- **GitHub Repo:** https://github.com/Maryoma-commits/NexuesPc (Private)

### Products by Retailer:
- **Kolshzin:** 2,042 products (largest)
- **JokerCenter:** 1,194 products ✅
- **GlobalIraq:** 842 products
- **3D-Iraq:** 840 products
- **Alityan:** 584 products
- **Altajit:** 355 products
- **Galaxy IQ:** 353 products (manual)
- **SpNIQ:** 269 products
- **Almanjam:** 153 products

### Top Categories by Product Count:
1. Keyboard: 700 products
2. Monitor: 690 products
3. Mouse: 635 products
4. GPU: 552 products
5. Cooler: 517 products
6. Motherboards: 468 products
7. Case: 436 products
8. Power Supply: 355 products
9. Headset: 345 products
10. Storage: 296 products
11. CPU: 255 products
12. RAM: 202 products
13. Laptop: 175 products
14. Other: 184 products

---

## 💡 Future Ideas / TODOs
- [x] Fix JokerCenter SSL certificate (fixed by JokerCenter - 2025-12-21)
- [x] Galaxy IQ has all categories (12 total: Case, Cooler, CPU, GPU, Headsets, Keyboard, Laptops, Monitors, Motherboards, Mouse, Power Supply, RAM, Storage)
- [ ] Consider custom domain purchase
- [ ] PWA/APK generation (if needed)
- [ ] Automated GitHub Actions for scheduled scraping
- [ ] Add Google AdSense when traffic grows
- [ ] User accounts/saved builds (future)

---

**Last Updated:** 2025-12-21 04:02  
**Status:** Production ✅  
**Agent:** Rovo Dev
