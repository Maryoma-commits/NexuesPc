# NexusPC Scraper - Usage Guide

## 🎯 Two Modes Available

### 1️⃣ CLI Mode (Interactive Menu) - For Testing

**Run:**
```bash
cd backend
python main.py
```

**What you'll see:**
```
🚀 NexusPC Product Scraper - CLI Mode
============================================================
🛒 NexusPC Scraper - Interactive Menu
============================================================

📋 Choose an option:
  1. GlobalIraq
  2. Alityan
  3. Kolshzin
  4. 3D-Iraq
  5. JokerCenter
  6. Almanjam
  7. Scrape ALL sites
  0. Exit

Enter your choice (0-7): _
```

**Features:**
- ✅ Interactive menu
- ✅ Scrape individual sites
- ✅ Scrape all sites
- ✅ **Uses MERGE logic** - keeps data from sites you don't scrape
- ✅ Perfect for testing

---

### 2️⃣ Server Mode (Web API) - For Production

**Run:**
```bash
cd backend
uvicorn main:app --reload
```

**Available Endpoints:**

#### Scrape All Sites
```bash
POST http://localhost:8000/scrape
```

#### Scrape Single Site (with merge)
```bash
POST http://localhost:8000/scrape/globaliraq
POST http://localhost:8000/scrape/alityan
POST http://localhost:8000/scrape/kolshzin
POST http://localhost:8000/scrape/3d-iraq
POST http://localhost:8000/scrape/jokercenter
POST http://localhost:8000/scrape/almanjam
```

#### Check Status
```bash
GET http://localhost:8000/status
```

**Features:**
- ✅ Web server mode
- ✅ API endpoints
- ✅ Auto-scraping on startup
- ✅ Periodic scraping every 6 hours
- ✅ Individual site scraping with merge

---

## 🔄 How Merge Works

### Example Scenario:

**Initial State:**
```json
{
  "GlobalIraq": 100 products,
  "Alityan": 200 products,
  "Kolshzin": 150 products
}
```

**You scrape only Almanjam (CLI or API):**
```bash
python main.py
> Choose: 6 (Almanjam)
```

**Result:**
```json
{
  "GlobalIraq": 100 products,    ← KEPT (not touched)
  "Alityan": 200 products,       ← KEPT (not touched)
  "Kolshzin": 150 products,      ← KEPT (not touched)
  "Almanjam": 50 products        ← NEW (just scraped)
}
```

**You scrape ALL sites:**
```bash
python main.py
> Choose: 7 (Scrape ALL)
```

**Result:**
```json
{
  "GlobalIraq": 105 products,    ← UPDATED (all scraped fresh)
  "Alityan": 210 products,       ← UPDATED
  "Kolshzin": 155 products,      ← UPDATED
  "Almanjam": 52 products        ← UPDATED
}
```

---

## 📝 Quick Reference

### CLI Mode Commands
```bash
# Run interactive menu
python main.py

# Options:
# 1-6: Scrape individual site (merges with existing data)
# 7: Scrape all sites (replaces all data)
# 0: Exit
```

### API Mode Commands
```bash
# Start server
uvicorn main:app --reload

# Scrape single site (merge)
curl -X POST http://localhost:8000/scrape/almanjam

# Scrape all sites (replace)
curl -X POST http://localhost:8000/scrape

# Check status
curl http://localhost:8000/status
```

---

## 🎯 Recommendations

**For Testing/Development:**
- Use CLI mode: `python main.py`
- Quick, interactive, easy to debug
- Perfect for testing individual scrapers

**For Production:**
- Use Server mode: `uvicorn main:app --reload`
- Web API for frontend integration
- Automatic periodic scraping
- Can trigger from anywhere

---

## ⚠️ Important Notes

1. **CLI mode blocks** - can't use server features while interactive menu is running
2. **Server mode runs in background** - periodic scraping happens automatically
3. **Merge preserves data** - scraping one site won't delete others
4. **All sites scrape replaces** - option 7 or `/scrape` endpoint replaces everything
5. **Be nice to retailers** - don't spam requests, respect rate limits

---

## 🚀 Sites Available

1. **GlobalIraq** - `globaliraq`
2. **Alityan** - `alityan`
3. **Kolshzin** - `kolshzin`
4. **3D-Iraq** - `3d-iraq`
5. **JokerCenter** - `jokercenter`
6. **Almanjam** - `almanjam` ✨ NEW!

---

Enjoy scraping! 🛒
