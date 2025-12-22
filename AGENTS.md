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

### 2025-12-21 (Part 2 - Save/Share System & UI/UX Overhaul)
**Major Features:**
- Save & Share PC Builds: Complete system with localStorage, URL sharing, auto-restore (24h)
- Enhanced Load Modal: Grid/list views, sort by date/price, component count badges, category tags, build notes, component icons (green=selected, gray=missing)
- Edit Builds: Update existing or save as new with two-button modal
- Reset Build: Clear all components button
- Single-view PC Builder: Auto-back navigation after component selection, compact 4-column component cards

**UI/UX Improvements:**
- Moved sort dropdown to product header (removed from sidebar - no more scrollbar)
- Fixed body scroll when PC Builder is open (overflow: hidden)
- Fixed toggle button particle overflow causing scrollbars
- Updated component icons: RAM (MemoryStick), GPU (Gpu) - distinct from Monitor/Motherboard
- Changed PC Builder subtitle to "Build your PC" (shorter)
- Admin panel: Loading overlay instead of alert popups

**Light/Dark Mode Polish:**
- Theme persistence: Saves to localStorage, persists across page refreshes
- Fixed all dropdowns (PC Builder + main page) for light/dark mode
- Fixed ShareBuildModal button colors (white text/icons forced)
- Fixed Save button in PC Builder (white text in both modes)
- Consistent styling across all modals and inputs

**Bug Fixes:**
- Fixed share URL encoding (retailer field: site → retailer)
- Fixed text export showing undefined retailer
- Fixed build names in shared URLs
- Fixed auto-restore not clearing on component removal/reset
- Fixed 404 errors: Removed /code/style.css, added favicon.svg
- Removed all console.log statements (production-ready)

**Technical Changes:**
- Created utils/buildStorage.ts (localStorage save/load/delete/auto-save)
- Created utils/buildEncoder.ts (URL encoding/decoding with base64)
- Created LoadBuildsModal.tsx, SaveBuildModal.tsx, ShareBuildModal.tsx
- Updated SavedBuild interface: Added tags and notes fields
- Component icons now consistent across PC Builder and Load Modal

### 2025-12-21 (Part 1)
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

## 🔢 Current Stats (Last Updated: 2025-12-21 06:30 AM)
- **Total Products:** 6,640
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

**Last Updated:** 2025-12-22 04:28  
**Status:** Production ✅  
**Recent Session:** Implemented Firebase real-time chat system with authentication, profile caching, and email verification  
**Agent:** Rovo Dev

---

## 💬 Community Chat System (NEW - 2025-12-22)

### Overview
Full-featured real-time chat system with Firebase integration, allowing users to communicate globally and privately.

### Architecture

**Authentication (Firebase Auth):**
- Google Sign-In (instant access)
- Email/Password with mandatory email verification
- Global AuthContext for site-wide authentication state
- User profiles stored in Firebase Realtime Database

**Chat System (Firebase Realtime Database):**
- Global chat room (all users)
- Direct messages (private 1-on-1 conversations)
- Real-time message synchronization
- Profile caching for performance

**Database Structure:**
```
firebase/
├── users/{userId}/
│   ├── displayName, email, photoURL, bio
│   ├── createdAt, lastOnline, isOnline
│   └── (profiles fetched dynamically)
├── globalChat/messages/{messageId}/
│   ├── text, senderId, timestamp, type
│   └── (NO senderName/Photo - fetched from users/)
├── directMessages/{user1_user2}/messages/{messageId}/
│   ├── text, senderId, recipientId, timestamp
│   └── (profiles fetched dynamically)
└── conversations/{user1_user2}/
    ├── participants[], lastMessage, lastMessageTime
    └── unreadCount{userId: count}
```

### Key Features

**1. Authentication & Security:**
- Email verification required (anti-spam)
- Resend verification email option
- Loading states prevent auth flashing
- Portal-based modals (proper z-index layering)

**2. Profile System:**
- Dynamic profile caching (Option 2 hybrid approach)
- Profile changes reflect everywhere instantly
- Edit profile from navbar dropdown
- Auto-generated avatars for users without photos

**3. Global Chat:**
- Real-time messaging with 10-second timestamp updates
- Emoji picker (400px height, 280px width)
- Clickable user avatars → dropdown menu
- "Send Message" to open DM with user
- Delete own messages + Report system
- Message context menu (positioned to prevent cutoff)

**4. Direct Messages:**
- Private 1-on-1 conversations
- Conversation list with unread badges
- Auto-fetch profiles for participants
- Click avatar in Global Chat → Auto-open DM
- No search UI (start DM from Global Chat avatars)

**5. UI/UX:**
- Floating chat bubble (bottom-right)
- No minimize button (open/close only)
- Emoji picker stays open (multi-emoji selection)
- Context menu positioned to avoid screen edges
- Loading states for messages (no flash of empty state)
- Dark/Light mode support

### Important Technical Decisions

**Profile Caching Strategy:**
- Messages store ONLY `senderId` (not name/photo)
- Profiles fetched once per chat session and cached in component state
- Benefits: Profile updates reflect everywhere, no duplicate data, smaller messages
- Trade-off: 1-2 extra database reads per unique user (negligible)

**Authentication Flow:**
- Sign up → Email sent → User signed out → Must verify → Can sign in
- Google users bypass verification (already trusted)
- Auth state managed globally via AuthContext
- Loading skeleton prevents "Sign In" button flash

**Chat Window:**
- No Edit Profile/Logout in chat (only in navbar)
- No minimize functionality (simplified UX)
- Auto-switch to DMs when clicking "Send Message" on avatar

### Components

**Chat:**
- `components/chat/ChatBubble.tsx` - Floating button with unread badges
- `components/chat/ChatWindow.tsx` - Main container with tabs
- `components/chat/GlobalChat.tsx` - Global chat room
- `components/chat/DirectMessages.tsx` - DM interface
- `components/chat/UserProfileMenu.tsx` - Avatar click dropdown

**Auth:**
- `components/auth/AuthModal.tsx` - Sign in/up (portal-based)
- `components/auth/UserProfile.tsx` - Profile editor (portal-based)
- `components/auth/UserMenu.tsx` - Navbar dropdown
- `contexts/AuthContext.tsx` - Global auth state

**Services:**
- `services/authService.ts` - Firebase auth functions
- `services/chatService.ts` - Message CRUD operations
- `firebase.config.ts` - Firebase initialization

### Firebase Configuration
- **Project:** nexuspc-a9df6
- **Region:** europe-west1 (Belgium)
- **Auth Methods:** Google, Email/Password
- **Database URL:** https://nexuspc-a9df6-default-rtdb.europe-west1.firebasedatabase.app

### Known Behaviors

**Expected:**
- Timestamp updates every 10 seconds
- Emoji picker stays open after selection
- Old messages show updated user names after profile change (cached profiles refetch)
- "Loading messages..." shown briefly when switching tabs
- Context menus position to left on right side of screen

**Future Enhancements:**
- [ ] Typing indicators
- [ ] Read receipts  
- [ ] Image/file sharing
- [ ] Message reactions
- [ ] User online/offline status indicators
- [ ] Push notifications

---
