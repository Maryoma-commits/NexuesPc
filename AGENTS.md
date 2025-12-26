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

### 2025-12-26 (Part 3 - Messenger UI & Seen Feature)
**Major Features:**
- **Facebook Messenger-Style Input Field:**
    - Redesigned layout: Left icons (Image + PC Build) → Input field → Emoji (inside) → Send/Thumbs up (outside)
    - Rounded pill input (`rounded-full`, light gray background)
    - All icons same size (36px buttons) and color (`#0066d9`)
    - Thumbs up icon when empty, Send icon when typing
    - Proper vertical alignment with input field
- **Caption Above Image:** Fixed message order to match Facebook Messenger
    - Caption text bubble appears ABOVE image (not below)
    - Text bubble doesn't stretch to image width (`inline-block`)
    - Sent messages: caption aligns right, received: left
    - Clean separation: Text → Image → Build
- **"Seen by X" Feature in Global Chat:**
    - Real-time tracking of who viewed each message
    - Shows "Seen by 5" count below the last message only
    - Only marks as seen when chat is open and viewing
    - Optimized: Only marks once per user per message (prevents performance issues)
    - Database: `globalChat/messages/{messageId}/seenBy/{userId}: timestamp`
- **Admin Dashboard Improvements:**
    - "Delete All" button in Message Moderation for current tab
    - Double confirmation: Confirm dialog + type "DELETE ALL"
    - Tab-specific deletion: Reported, All Messages, Global Chat, Direct Messages
    - Loading state with toast feedback
- **Message Read Tracking Fix:**
    - Messages no longer marked as seen when chat is closed
    - Fixed Firefox-specific issue with `document.hidden` check
    - Added Page Visibility API for cross-browser compatibility
    - Only marks as seen when: chat open + tab visible + document focused

**Technical Implementation:**
- `services/chatService.ts`: Added `seenBy`, `markGlobalMessageAsSeen()`, `getSeenCount()`, `getSeenByUsers()`
- `components/chat/GlobalChat.tsx`: Auto-mark messages as seen, display count on last message
- `components/chat/DirectMessages.tsx`: Added `isOpen` prop, visibility checks
- `components/admin/MessageModeration.tsx`: Added `handleDeleteAllInTab()` with bulk delete
- Input field: `rounded-full`, `bg-gray-100`, `#0066d9` color, `w-9 h-9` buttons
- Custom icons: `thumbsup.png` (28px), `send-message.png` (24px)

**Bug Fixes:**
- Fixed message order (caption now above image, not below)
- Fixed text bubble stretching to image width
- Fixed sent message captions aligning left (now right-aligned)
- Fixed messages being marked as seen when chat closed
- Fixed Firefox-specific seen tracking issue
- Fixed performance issue (checking `seenBy` before marking)
- Fixed website crash (added `index` parameter to `.map()`)
- Fixed reversed array index (`index === 0` for last message)

### 2025-12-26 (Part 2 - Build Storage Migration & Load from Chat)
**Major Features:**
- **Firebase Build Storage:** Migrated from localStorage to Firebase Database per user account.
    - Saved builds stored at `users/{userId}/savedBuilds/{buildId}`
    - Auto-save kept in **localStorage** for instant recovery (no network delay)
    - Syncs across all devices and browsers
    - Persists even after browser data clear
    - No migration needed (site not yet public)
- **Load Build from Chat:** Users can load shared builds directly into PC Builder.
    - "Load Build in PC Builder" button in BuildPreviewCard (Download icon)
    - Opens PC Builder with all components pre-loaded
    - Toast notification when loading
    - Supports both legacy (full Product objects) and new (simplified BuildData) formats
    - Smart 3-tier product matching: exact → case-insensitive → fallback (title + price only)
- **UI Improvements:**
    - Changed image upload icon from Paperclip to Image icon
    - Removed caption input from build sharing (direct share only)

**Technical Implementation:**
- `services/buildStorageService.ts`: New Firebase-based build storage service (300+ lines)
- `utils/buildStorage.ts`: Updated to use Firebase service (maintains backward compatibility)
- `components/LoadBuildsModal.tsx`: Uses async `getSavedBuildsAsync()`
- `components/chat/BuildShareModal.tsx`: Uses async `getSavedBuildsAsync()` + auto-migration
- `components/PCBuilder.tsx`: Uses async `getAutoSavedBuildAsync()` + auto-migration
- `components/chat/BuildPreviewCard.tsx`: Added "Load Build" button with callback chain
- Callback chain: BuildPreviewCard → GlobalChat → ChatWindow → ChatBubble → App → PCBuilder

**Database Structure:**
```
users/{userId}/
└── savedBuilds/
    └── {buildId}/
        ├── id, name, dateCreated, dateModified
        ├── components: { cpu, gpu, ram, ... }
        ├── totalPrice, tags, notes

localStorage/
└── nexuspc_autosave  (auto-save kept in browser for instant recovery)
```

**Bug Fixes:**
- Fixed build loading from chat (was showing "undefined" titles due to Product vs BuildData format mismatch)
- Added legacy format support for old shared builds
- Fixed async loading in all components

### 2025-12-26 (Part 1 - PC Build Sharing & Admin Enhancements)
**Major Features:**
- **PC Build Sharing in Chat:** Users can now share their saved PC builds in Global Chat and Direct Messages.
    - Monitor icon (🖥️) button next to image upload in chat input
    - BuildShareModal: Select from saved builds with preview (name, price, CPU, GPU, component count)
    - Optional caption with shared builds
    - BuildPreviewCard: Compact card display (280px width) with expand/collapse functionality
    - Collapsed view: Build name, total price, component count, CPU & GPU preview
    - Expanded view: Full component list with images, prices, and retailer names
    - Proper handling of Product properties (title, imageUrl) vs BuildData (name, image)
    - Conversation list shows "🖥️ PC Build" for build messages
- **Forgot Password Feature:** Self-service password reset for email users.
    - "Forgot Password?" link on sign-in screen (blue, below Sign In button)
    - Clean reset form with email input only (hides Google sign-in)
    - Firebase `sendPasswordResetEmail()` integration
    - Success message with email confirmation
    - "Back to Sign In" navigation
    - Email template customizable in Firebase Console with %DISPLAY_NAME% placeholder
- **Real-Time Presence System:** Accurate online/offline status tracking.
    - Firebase `.info/connected` detection (not manual polling)
    - Auto-sets offline when tab closes or internet disconnects
    - Updates `lastOnline` every 30 seconds while active
    - Green dot indicator on user avatars when online
    - "Online now" text in admin dashboard (green, bold)
    - Users considered online if active within last 90 seconds
    - Proper cleanup on logout (clears interval)
- **Admin Message Moderation System:** Complete moderation tools with real-time updates.
    - New "Message Moderation" tab in admin dashboard
    - 4 sub-tabs: Reported, All Messages, Global Chat, Direct Messages
    - Real-time auto-updates using Firebase `onChildAdded`/`onChildRemoved` (NOT onValue to avoid typing indicator spam)
    - DM messages grouped by conversation (one row per conversation, not per message)
    - Shows both participants in DM rows: "User1 ↔️ User2" with overlapping avatars
    - Message count badge on DM rows (e.g., "45 messages")
    - Click DM row → Opens ConversationViewerModal with full message history
    - ConversationViewerModal features:
        - Both user avatars and names in header
        - Full scrollable message history (oldest to newest)
        - Real-time updates (new messages appear instantly with auto-scroll)
        - Select messages with checkboxes (individual or "Select All")
        - Delete selected messages (bulk) or individual trash icons
        - Ban either user with reason prompt
        - Export conversation to .txt file
        - Delete entire conversation (removes all messages + metadata)
    - Reported messages section with full context:
        - Reporter avatar + name + reason + timestamp
        - Original message display (text or image with "View Image" link)
        - Quick actions: Delete Message, Ban User, Dismiss Report
    - Action buttons removed from DM table rows (confusing, now shows "Click row to manage")
    - Manual refresh button with toast notification
    - Profile caching for performance
    - Dark mode support throughout
- **Firebase Error Message Improvements:** User-friendly error messages for all authentication errors.
    - Changed `formatFirebaseError()` to accept full error object (not just message string)
    - Checks `error.code` property first (Firebase v9+ standard)
    - Maps all common Firebase error codes to friendly messages
    - Added `auth/invalid-credential` for newer Firebase versions
    - Examples:
        - `auth/wrong-password` → "Invalid email or password. Please try again."
        - `auth/user-not-found` → "No account found with this email. Please check your email or sign up."
        - `auth/email-already-in-use` → "This email is already registered. Please sign in instead or use a different email."
- **Delete Confirmation Simplification:** Removed "type DELETE" requirement in admin dashboard.
    - Changed from text input confirmation to simple two-button modal
    - User clicks "Delete User" → Confirms → User deleted
    - Warning banner and message handling options still present
    - Much faster and less frustrating for admins

**Technical Implementation:**
- `services/chatService.ts`: Added `BuildData` interface with components structure
- `components/chat/BuildShareModal.tsx`: Modal to select saved builds (150 lines)
- `components/chat/BuildPreviewCard.tsx`: Compact/expandable build display (140 lines)
- `components/chat/GlobalChat.tsx`: Integrated Monitor button, build preview rendering, and modal
- `services/authService.ts`: Added `sendPasswordReset()`, updated presence system with `initializePresenceSystem()` and `cleanupPresenceSystem()`
- `contexts/AuthContext.tsx`: Calls `initializePresenceSystem()` on sign-in, cleanup on logout
- `services/adminService.ts`: Added message moderation functions (getAllGlobalMessages, getAllDMMessages, getAllReports, adminDeleteMessage, dismissReport)
- `components/admin/MessageModeration.tsx`: Main moderation interface with tabs and real-time listeners (500+ lines)
- `components/admin/ConversationViewerModal.tsx`: Full DM conversation viewer with real-time updates (400+ lines)
- `components/admin/UserManagement.tsx`: Added refresh button, green dot for online users, "Online now" text
- `components/admin/DeleteUserModal.tsx`: Simplified to two-button confirmation
- `components/auth/AuthModal.tsx`: Added forgot password mode, improved error handling
- Updated `sendGlobalMessage()` and `sendDirectMessage()` to accept `buildData` parameter

**Bug Fixes:**
- Fixed admin ban user function parameter order (was passing `reason` as `bannedBy`)
- Fixed message moderation refresh spam from typing indicators (switched to `onChildAdded`/`onChildRemoved`)
- Fixed DM table showing every message as separate row (now groups by conversation)
- Fixed delete button in DM table deleting wrong conversation (removed action buttons, use conversation viewer instead)
- Fixed BuildPreviewCard property access (`imageUrl` before `image`, `title` before `name`)
- Fixed `[object Object]` in image URLs by correcting property order
- Fixed BuildShareModal using `createdAt` instead of `dateCreated` from SavedBuild

**Database Structure:**
```
buildData: {
  name: string,
  components: {
    [category]: {
      title: string,
      imageUrl: string,
      price: number,
      retailer: string
    }
  },
  totalPrice: number,
  createdAt: number
}
```

## 📝 Recent Major Changes

### 2025-12-24 (Part 3 - Error Handling & Auto-Send)
**Major Features:**
- **Toast Notifications:** Comprehensive error handling with react-hot-toast across all chat operations.
    - Success toasts (green, 2s) for positive actions (message sent, profile updated, etc.)
    - Error toasts (red, 4s) for failures with user-friendly messages
    - Replaced all console.error() with visible user feedback
- **WhatsApp-Style Auto-Send:** Messages sent offline show "Sending..." and auto-send when connection returns.
    - Optimistic message display (appears instantly)
    - "Sending..." status for offline messages
    - Browser online/offline event listeners
    - Automatic retry when WiFi reconnects
    - No manual retry/delete buttons needed
- **Optimistic Seen Status:** Reduced perceived delay for read receipts.
    - Local state updates immediately when marking as read
    - Firebase syncs in background
    - 1-3 second delay is normal Firebase behavior (matches WhatsApp/Messenger)
- **Status Indicators:**
    - "Sending..." - Message pending offline
    - "Sent" - Message delivered (replaced checkmark icon with text)
    - Seen avatar - Recipient viewed message

**Technical Implementation:**
- `status: 'pending'` for offline messages
- `window.addEventListener('online')` for auto-retry
- Optimistic `currentConversationMetadata` updates
- Toast provider in App.tsx with dark theme

**Bug Fixes:**
- Fixed sent checkmark showing during "Sending..."
- Fixed action button alignment with reactions + seen status
- Removed unused retry/delete functions

### 2025-12-24 (Part 2 - Chat Preloading & UI Fixes)
**Major Features:**
- **Chat Preloading System:** Eliminated all loading flashes when switching tabs or conversations.
    - Both Global Chat and Direct Messages stay mounted (CSS visibility toggle instead of unmounting).
    - Firebase listeners created for ALL conversations simultaneously (not just selected one).
    - Messages cached in ref - instant display when switching conversations.
    - Smart cleanup: Only removes listeners for deleted conversations, keeps active ones alive.
- **Fixed Message Sending:** Messages now appear instantly after sending (no need to close/reopen chat).
    - Used `selectedConversationRef` to track current selection (prevents closure stale data issues).
    - Listeners check ref instead of closure variable for accurate real-time updates.
- **Fixed Reaction/Seen Status Overlap:** Seen status indicator now has proper spacing when reactions exist.
    - Conditional margin: `mt-4` when reactions present, `mt-1` when none.
    - Prevents reaction emoji from covering the tiny "Seen" avatar.
- **Fixed Action Button Alignment:** Action buttons now anchor to message bubble, not outer container.
    - Moved action buttons inside message bubble div (line 473 in DirectMessages.tsx).
    - Always use `bottom-0` relative to bubble itself - perfect alignment regardless of reactions/seen status.
- **Smart Badge Logic:** DM tab badge now excludes current conversation's unread count.
    - Added `onConversationChange` callback from DirectMessages to ChatWindow.
    - Badge only shows unread from OTHER conversations when viewing a specific chat.
    - No false badge when receiving messages in active conversation.

**Technical Implementation:**
- `messageCache.current[conversationId]` stores messages for each conversation
- `activeListeners.current[conversationId]` tracks Firebase unsubscribe functions
- `selectedConversationRef.current` provides accurate selection state to listeners
- `selectedConversationId` in ChatWindow tracks which DM is open for badge calculation
- Dependency array simplified: `[conversations]` instead of `[conversations, selectedConversation]`

**Bug Fixes:**
- Fixed listeners being removed on tab switch (was breaking message sending/reactions)
- Fixed action buttons misalignment when reactions + seen status present
- Fixed badge showing for currently-viewed conversation
- Removed debug console.log statements (production-ready)

### 2025-12-24 (Part 1 - Chat UI/UX & Reliability Overhaul)
**Major Features:**
- **Reverse Flex Architecture:** Switched messages container to `flex-col-reverse`. This pins the view to the bottom naturally, matching Facebook/Messenger and eliminating scroll jumps when messages arrive or typing indicators disappear.
- **Messenger-style Replies:** Redesigned reply UI with stacked preview bubbles. Own messages use vibrant purple (`#7835F7`), while previews use deep grey (`#3E4042`).
- **Jump to Message:** Replies are now clickable. Clicking the header or preview bubble smoothly scrolls the chat to the original message with a 2-second blue highlight animation.
- **Sent/Seen Status:** Implemented reliable status indicators for Direct Messages.
    - **Seen:** Recipient's tiny avatar appears next to the last message they read.
    - **Sent:** Grey check icon appears if not yet seen.
    - **Reliability:** Switched to Firebase `serverTimestamp()` to eliminate device clock drift issues. Added periodic sync and focus detection.
- **Enhanced Emoji/Reaction UI:** 
    - Matched "perfect example" spacing (5px gap between emojis and count).
    - Used `w-max` to ensure badge backgrounds perfectly contain content.
    - Updated count to 10px regular font weight for a cleaner look.
    - Added high-z-index portals (`z-[100]`) and backdrops for both emoji and reaction pickers, allowing them to close on any outside click.

**UI/UX Improvements:**
- **Scroll Locking:** Added mouse hover listeners to the chat modal to lock background page scrolling (`overflow: hidden`) whenever the mouse is over the chat UI.
- **Typing Indicator Polish:** Typing status now correctly triggers when picking emojis from the input field picker.
- **Action Bar Persistence:** The message action bar (React, Reply, More) now stays visible while the reaction picker is open.
- **ResizeObserver Stability:** Added height monitoring to ensures the chat stays pinned to the absolute bottom even when avatars or reactions load asynchronously.

**Bug Fixes:**
- Fixed JSX syntax errors in `DirectMessages.tsx`.
- Resolved issue where `margin-left` was ignored in flex containers by switching to `gap` and `padding`.
- Fixed "scrolling leak" where chat limits would trigger background page scrolling.

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

### ❌ CRITICAL - Must Fix Before Production Launch
- [x] **Error Handling:** Toast notifications + WhatsApp-style auto-send (DONE - 2025-12-24)
- [ ] **Rate Limiting:** Implement message send rate limiting (max 10 messages/minute per user)
- [ ] **Input Validation:** Add max message length (2000 chars) and content sanitization
- [ ] **Firebase Security Rules:** Review and tighten security rules in Firebase Console
- [ ] **Error Tracking:** Add Sentry or similar error monitoring service

### ⚠️ IMPORTANT - Should Fix Within Week 1
- [ ] **Memory Leak Testing:** Test with 50+ conversations over extended periods
- [ ] **Offline Handling:** Add offline indicator and reconnection logic
- [ ] **Admin Moderation:** Build admin panel to review reports and ban users
- [ ] **Mobile Testing:** Verify full responsiveness on all mobile devices
- [ ] **Cross-browser Testing:** Test on Chrome, Firefox, Safari, Edge

### 🔧 Product Features (Completed)
- [x] Fix JokerCenter SSL certificate (fixed by JokerCenter - 2025-12-21)
- [x] Galaxy IQ has all categories (12 total: Case, Cooler, CPU, GPU, Headsets, Keyboard, Laptops, Monitors, Motherboards, Mouse, Power Supply, RAM, Storage)
- [x] Chat preloading system (no loading flashes)
- [x] Real-time messaging with reactions, replies, typing indicators
- [x] Message pagination and infinite scroll
- [x] Instagram-style conversation deletion
- [x] Facebook-style emoji reactions
- [x] Sent/Seen status with server timestamps
- [x] RTL/LTR auto-detection

### 🚀 Future Enhancements (Nice to Have)
- [ ] Message editing (currently only delete)
- [ ] Online/offline status indicators (green dot)
- [ ] Push notifications (requires service worker)
- [ ] Image/file sharing in messages
- [ ] Voice messages
- [ ] Message search functionality
- [ ] User @mentions
- [ ] Consider custom domain purchase
- [ ] PWA/APK generation (if needed)
- [ ] Automated GitHub Actions for scheduled scraping
- [ ] Add Google AdSense when traffic grows

---

**Last Updated:** 2025-12-26 07:00  
**Status:** Production Ready ✅  
**Recent Session:** Improved IP ban UX - banned users no longer see brief "signed in" flash before being kicked out. IP check now happens BEFORE setting auth state.
**Production Status:** 9.8/10 - Full Messenger-style chat with seen tracking, optimized UI/UX, complete admin tools with bulk delete. Ready for launch after rate limiting implementation.
**Agent:** Claude Code Agent (Rovo Dev)

---

## 🔒 Recent Security Improvements

### 2025-12-26 - IP Ban UX Enhancement (Commit 41da713)
**Issue Fixed:**
- Users with banned IPs would briefly see "signed in" UI before being kicked out
- Poor user experience with visible state flashing

**Solution Implemented:**
- Moved IP ban check to happen BEFORE setting user state in `AuthContext.tsx`
- Order of operations now:
  1. User attempts sign-in
  2. Load user profile
  3. **Check IP ban status FIRST**
  4. If banned → Sign out immediately + error toast (no UI flash)
  5. If not banned → Set user state + continue normal flow

**Technical Changes:**
- `setUser(currentUser)` now called AFTER IP check passes (line 76)
- Added `setUser(null)` in ban handler to ensure clean state
- Loading state stays true during IP check (prevents UI flash)

**Result:** Smooth, professional ban enforcement with no visual glitches ✅

---

## 🖼️ Image Sharing in Chat (NEW - 2025-12-25)

### Overview
Full image sharing functionality in both Global Chat and Direct Messages using ImgBB hosting.

### Features
- **Upload via Paperclip:** Click 📎 button next to message input
- **File Validation:** Max 5MB, JPEG/PNG/GIF/WebP only
- **Preview Before Send:** Thumbnail with cancel button (X)
- **Optional Captions:** Add text with images
- **Fullscreen Lightbox:** Click image to view full size
- **Toast Notifications:** Success/error feedback

### Technical Implementation
- **Storage:** ImgBB API (free, unlimited)
- **Upload Function:** `uploadChatImage()` in chatService.ts
- **Message Type:** `imageUrl` field added to Message interface
- **Conversation List:** Shows "📷 Photo" for image messages

### Files Modified
- `services/chatService.ts` - Added uploadChatImage(), updated sendGlobalMessage/sendDirectMessage
- `components/chat/GlobalChat.tsx` - Image upload UI, preview, lightbox
- `components/chat/DirectMessages.tsx` - Image upload UI, preview, lightbox

---

## 🛡️ Admin Dashboard (NEW - 2025-12-25)

### Overview
Complete admin control panel for user management and system monitoring. Only accessible to whitelisted admin UIDs.

### Access Control
**Admin Whitelist:** `constants/adminConfig.ts`
```typescript
export const ADMIN_UIDS = [
  '6S4vRBMUVHf3GAvzKW6ShjY...', // Your UID
  // Add more admin UIDs here
];
```

### Features

#### User Management
- **User List Table:** All registered users with pagination (20/page)
- **Search:** By name or email (real-time)
- **Filter:** By sign-in method (Google/Email)
- **User Details Modal:** Full profile, message count, conversation count
- **Provider Detection:** Auto-detects from Firebase Auth providerData

#### User Actions
1. **View Details (👁️):** 
   - Display name, email, join date, last active
   - Total messages sent (Global + DM)
   - Number of conversations
   - User ID (for debugging)

2. **Ban User (⚠️):**
   - **Permanent Ban:** Until manually unbanned
   - **Temporary Ban:** 1h, 3h, 6h, 12h, 24h, 2d, 3d, 1w, 2w, 1mo
   - Ban reason required
   - Banned users cannot send messages (enforced in chatService)
   - Ban persists even after account deletion
   - Unban button for banned users

3. **Delete User (🗑️):**
   - **Option 1:** Anonymize messages (keeps messages, changes to "[Message from deleted user]")
   - **Option 2:** Delete all messages (removes everything)
   - Type "DELETE" to confirm
   - Removes: Profile, messages (optional), conversations, typing indicators
   - **Note:** Does NOT delete from Firebase Authentication (manual step required)
   - **Best Practice:** Ban first, then delete from dashboard, then delete from Firebase Console

#### System Statistics
- Total users, online users, new users today
- Total messages (Global + DM breakdown)
- Total conversations
- Banned users count
- Activity rate, growth rate, engagement metrics
- Beautiful gradient stat cards with progress bars

### Navigation
- **Access:** Click avatar → "Admin Dashboard" (Shield icon) OR visit `/admin`
- **Tabs:** User Management, Statistics, Banned Users
- **Back Button:** Arrow in header returns to main site
- **Dark Mode:** Syncs with main site theme

### Database Operations
**Ban Enforcement:**
```typescript
// Checked before EVERY message send
const banRef = ref(database, `bannedUsers/${senderId}`);
// If banned → Error toast with reason
// If temporary ban expired → Auto-removes ban
```

**Provider Detection:**
```typescript
// Runs on every sign-in via onAuthChange
const provider = user.providerData[0]?.providerId;
const providerType = provider === 'google.com' ? 'google' : 'email';
await update(userRef, { provider: providerType });
```

### Files Created
- `constants/adminConfig.ts` - Admin whitelist
- `services/adminService.ts` - All admin functions (deleteUserAccount, banUser, unbanUser, getSystemStats, etc.)
- `components/admin/AdminDashboard.tsx` - Main layout with tabs
- `components/admin/UserManagement.tsx` - User list with search/filter
- `components/admin/UserDetailsModal.tsx` - User profile viewer
- `components/admin/DeleteUserModal.tsx` - Delete confirmation with options
- `components/admin/BanUserModal.tsx` - Ban/unban with temporary options
- `components/admin/Statistics.tsx` - System stats dashboard

### Security Notes
- Client-side cannot delete from Firebase Authentication (Google security restriction)
- Ban feature is recommended over delete for blocking users
- Admin routes protected by UID whitelist
- All destructive actions require confirmation

---

## 👤 User Onboarding System (NEW - 2025-12-25)

### Overview
Professional onboarding flow for new Google sign-in users to set custom display name and profile picture.

### Flow
1. **New Google User Signs In** → Page auto-refreshes
2. **Onboarding Modal Appears** (fullscreen, cannot close)
3. **User Enters:**
   - Display name (required text field)
   - Profile picture (optional upload, 5MB max)
4. **Click Continue** → Profile saved → Page refreshes
5. **Profile Loaded** → Name and photo display immediately
6. **Future Sign-Ins** → No onboarding (already completed)

### Detection Logic
```typescript
// Shows onboarding if ALL true:
const isGoogleUser = profile.provider === 'google';
const needsSetup = isGoogleUser && profile.displayName === 'User';
```

### New User Setup
- Google users start with `displayName = 'User'` (generic placeholder)
- Forces onboarding modal to appear
- After completion, name updates to custom choice
- Email users provide name during signup (no onboarding needed)

### Files Created
- `components/auth/OnboardingModal.tsx` - Profile setup modal

### Files Modified
- `services/authService.ts` - signInWithGoogle returns `{ user, isNewUser }`
- `components/auth/AuthModal.tsx` - Auto-refresh for new users
- `contexts/AuthContext.tsx` - needsOnboarding state + detection logic
- `App.tsx` - OnboardingModal integrated

---

## 📝 Profile System Simplification (2025-12-25)

### Changes
**Removed:**
- ❌ Bio field (completely removed from interface, database, all components)
- ❌ Photo URL text input (users can ONLY upload photos)

**What Remains:**
- ✅ Display Name (editable text field)
- ✅ Profile Picture (camera upload button only, max 5MB)
- ✅ Email (read-only)
- ✅ Provider (Google/Email - stored but hidden from user)

### Affected Components
- `services/authService.ts` - Removed bio from UserProfile interface
- `components/auth/UserProfile.tsx` - Removed bio textarea and URL input
- `components/auth/OnboardingModal.tsx` - Removed bio field
- `components/admin/UserDetailsModal.tsx` - Removed bio display
- `contexts/AuthContext.tsx` - Onboarding detection changed from `bio === ''` to `displayName === 'User'`

---

## ✨ Error Message Improvements (2025-12-25)

### Professional Firebase Error Messages
All Firebase authentication errors now display user-friendly messages instead of technical codes.

**Examples:**
| Firebase Error | User Message |
|----------------|--------------|
| `Firebase: Error (auth/email-already-in-use)` | This email is already registered. Please sign in instead or use a different email. |
| `auth/weak-password` | Password is too weak. Please use at least 6 characters. |
| `auth/user-not-found` | No account found with this email. Please check your email or sign up. |
| `auth/wrong-password` | Incorrect password. Please try again. |
| `auth/too-many-requests` | Too many failed attempts. Please try again later. |

### Implementation
- Helper function: `formatFirebaseError()` in AuthModal.tsx
- Maps Firebase error codes to friendly messages
- Removes technical prefixes
- Applied to both email and Google sign-in errors

---

## 💬 Community Chat System (2025-12-22 - 2025-12-24)

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
- [x] Typing indicators (DONE - 2025-12-22)
- [x] Message replies (DONE - 2025-12-22)
- [x] Message pagination/infinite scroll (DONE - 2025-12-22)
- [x] Profile picture uploads (DONE - 2025-12-22)
- [x] Instagram-style conversation deletion (DONE - 2025-12-22)
- [x] Message reactions with Facebook emojis (DONE - 2025-12-23)
- [x] RTL/LTR auto-detection (DONE - 2025-12-23)
- [x] Full emoji picker (+ button functionality) (DONE - 2025-12-23)
- [x] Read receipts / Seen status (DONE - 2025-12-24)
- [x] Smooth scrolling / Reverse flex (DONE - 2025-12-24)
- [ ] Image/file sharing
- [ ] User online/offline status indicators
- [ ] Push notifications

**Known Issues:**
- None identified in the current session.

---

## 🐛 Critical Bug Fixes (2025-12-23)

### Unread Badge Bug (MAJOR FIX)
**Problem:** Unread badges appeared after page refresh even when viewing the conversation.

**Root Cause:**
- `markConversationAsRead()` only called when opening conversation
- Not called when receiving messages while viewing
- Page refresh showed stale unread count

**Solution (3-part fix):**
1. Added `lastReadTimestamp` to conversations (stores WHEN you read)
2. Modified `getUserConversations()` to recalculate unread based on timestamps
3. **KEY FIX:** Call `markConversationAsRead()` when receiving messages while viewing (not just on open)

**Files Changed:**
- `services/chatService.ts` - 3 functions updated
- `components/chat/DirectMessages.tsx` - Mark as read on message receive

### Reply Indicator Width
**Problem:** Long reply messages extended beyond message bubble width.

**Solution:**
- Changed `truncate` to `line-clamp-2 break-words`
- Reply indicator now shows up to 2 lines with proper wrapping
- Respects same `max-w-sm` (384px) as message bubbles

**Files Changed:**
- `components/chat/DirectMessages.tsx`
- `components/chat/GlobalChat.tsx`

### GlobalChat Auto-Scroll
**Problem:** When someone sent a message while you were at bottom, it didn't auto-scroll.

**Solution:**
- Added smart scroll position check (within 200px of bottom)
- Auto-scrolls instantly if you're at the bottom
- Doesn't scroll if you're reading older messages
- Same behavior as DirectMessages

**Files Changed:**
- `components/chat/GlobalChat.tsx`

### Multiple Typing Users Avatar Display
**Problem:** When 2+ people typed, showed only 1 avatar but multiple names.

**Solution:**
- Changed to show multiple overlapping avatars (up to 3)
- Facebook/Messenger style with `-space-x-2`
- Each avatar has border to separate visually

**Files Changed:**
- `components/chat/GlobalChat.tsx`

### Code Cleanup
**Removed:**
- 10+ debug `console.log` statements
- Unused imports: `Search`, `query`, `orderByChild`, `equalTo`, `getUserProfile`, `hasUserReacted`
- Unused packages: `@emoji-mart/data`, `@emoji-mart/react`

**Result:** Production-ready, clean codebase

---

## 🌍 RTL/LTR Auto-Detection (2025-12-23)

### Auto Text Direction
**Feature:** Input field automatically switches between LTR and RTL based on content.

**Implementation:**
```typescript
detectTextDirection(text) {
  // Checks for Arabic (\u0600-\u06FF) or Hebrew (\u0590-\u05FF)
  return hasRTLCharacters ? 'rtl' : 'ltr';
}
```

**Behavior:**
- Type English → `dir="ltr"` (cursor on right)
- Type Arabic → `dir="rtl"` (cursor on left)
- Real-time switching as you type
- Updates on every keystroke

**Files Changed:**
- `components/chat/GlobalChat.tsx` - Added direction state & detection
- `components/chat/DirectMessages.tsx` - Added direction state & detection

**Result:**
- Natural typing experience for multilingual users
- Proper cursor positioning
- Text flows in correct direction

---

## 💬 Message Reactions System (2025-12-23)

### Complete Facebook-Style Reaction System
**Provider:** Facebook Emoji CDN (emoji-datasource-facebook@15.0.1)

**Features Implemented:**
- ✅ Quick reaction picker (❤️ 😂 😮 😢 😡 👍 ➕)
- ✅ Instagram-style positioning (overlaps message bubble corner)
- ✅ Facebook emoji images (consistent across all platforms)
- ✅ One reaction per user (auto-replaces when switching)
- ✅ Reaction modal (view who reacted, remove your reaction)
- ✅ Real-time updates via Firebase

### Quick Reaction Picker
**Trigger:** Click Smile button (😊) on message hover
**Appears:** Above action buttons in dark pill
**Emojis:** 6 quick reactions + plus button
**Behavior:**
- Click emoji → React instantly
- Picker closes automatically
- Portal rendering (no clipping)
- Centered above Smile button

### Reaction Display
**Location:** Bottom-left corner of message bubble (overlapping)
**Format:** 
- Single reaction: Just emoji (no count)
- Multiple reactions: All emojis + total count
- Example: `❤️😊 5` means 5 total reactions with 2 emoji types

**Styling:**
- Facebook emoji images (16px on bubbles, 32px in modal)
- Gray rounded pill background
- Hover scale effect
- Clickable to open reaction modal

### Reaction Modal
**Opened by:** Clicking reaction bubble on message
**Features:**
- Header: "Message reactions" with X button
- Tabs: "All" + individual emoji tabs with counts
- User list: Avatar, name, emoji on right
- Remove reaction: "Click to remove" (only your reactions)
- Real-time updates: Firebase listener tracks changes
- Auto-close: When all reactions removed

**Database Structure:**
```
globalChat/messages/{messageId}/reactions/
  "❤️": ["uid1", "uid2", "uid3"]
  "😊": ["uid4"]

directMessages/{convId}/messages/{messageId}/reactions/
  "❤️": ["uid1", "uid2"]
  "👍": ["uid1"]
```

### Single Reaction Per User Logic
**Rules:**
1. User clicks ❤️ → Adds ❤️
2. User clicks 😂 → Removes ❤️, adds 😂 (auto-switch)
3. User clicks 😂 again → Removes 😂 (toggle off)

**Implementation:**
- `toggleReaction()` in chatService.ts
- Checks if user already has emoji BEFORE removing
- Removes all user's reactions first
- Adds new emoji if different from previous
- Empty emoji arrays auto-deleted

### Facebook Emoji Integration
**Component:** `components/ui/Emoji.tsx`
**Function:** Converts native emoji to Facebook images
```typescript
<Emoji emoji="❤️" size={32} />
// Renders: <img src="cdn.jsdelivr.net/.../2764-fe0f.png" />
```

**Conversion:**
- Native emoji → Unicode codepoints
- Example: "❤️" → "2764-fe0f"
- CDN URL: `emoji-datasource-facebook@15.0.1/img/facebook/64/{unified}.png`
- Fallback: Native emoji on image load error

**Applied Everywhere:**
- Quick reaction picker (32px)
- Reaction bubbles (16px)
- Reaction modal tabs (20px)
- Reaction modal user list (32px)
- Emoji picker in input field (emojiStyle="facebook")

### Plus Button
**Design:** Dark gray circle with white + symbol
**Size:** 32px (w-8 h-8)
**Styling:** `bg-gray-600 rounded-full`
**Function:** Opens full emoji picker (350+ emojis with search)

### Full Emoji Picker (COMPLETED)
**Opened by:** Clicking + button in quick reaction bar
**Features:**
- 350+ Facebook emojis with search
- Portal rendering (no clipping)
- Dark/Light mode support
- Centered above button
- Click emoji to react instantly
- Auto-close on reaction

**Implementation:**
- EmojiPicker component with `emojiStyle="facebook"`
- Height: 400px, Width: 350px
- Portal at document.body level
- Positioned 450px above button with translateX(-50%)

### Files Created/Modified
**New Files:**
- `components/ui/Emoji.tsx` - Facebook emoji renderer
- `components/chat/ReactionModal.tsx` - Reaction viewer/remover

**Modified Files:**
- `components/chat/GlobalChat.tsx` - Reaction picker + display
- `components/chat/DirectMessages.tsx` - Reaction picker + display
- `services/chatService.ts` - toggleReaction(), helper functions

---

## 🎨 Chat System Enhancements (2025-12-22)

### Profile Picture Upload System
**Provider:** ImgBB API (Free, unlimited storage)
- Upload from device (click camera icon in Edit Profile)
- Max 5MB, supports JPEG/PNG/GIF/WebP
- URL paste still supported as fallback
- API Key stored in `.env` (VITE_IMGBB_API_KEY)
- No Firebase Storage needed (billing issues)

### Smart Profile Caching (Option 1 - Real-time)
**Architecture:**
- Global cache in `AuthContext` with real-time Firebase listeners
- Profiles cached on first fetch, never re-fetched
- Real-time updates via Firebase `onValue` listeners
- Shared between GlobalChat and DirectMessages
- Zero staleness - updates propagate instantly

**Benefits:**
- Instant chat loading (no refetch on reopen)
- Profile changes reflect everywhere immediately
- Minimal Firebase reads (once per user per session)
- Listeners stay active throughout session

### Message Pagination & Infinite Scroll
**Implementation:**
- Loads last 50 messages initially (not all)
- Scroll to top → Auto-loads 50 older messages
- Uses Firebase `endBefore()` + `limitToLast()` queries
- Preserves scroll position when loading older messages
- Shows "Loading older messages..." spinner
- Shows "• Beginning of conversation •" when no more

**Firebase Indexes Required:**
```json
"globalChat/messages": { ".indexOn": ["timestamp"] }
"directMessages/$conversationId/messages": { ".indexOn": ["timestamp"] }
```

### Typing Indicators (Facebook/Messenger Style)
**Features:**
- Real-time typing status via Firebase
- Appears as message bubble with animated dots (●●●)
- Shows user avatar and name in Global Chat
- Shows "User is typing..." for single user
- Shows "User1 and User2 are typing..." for multiple
- Auto-clears after 2 seconds of inactivity
- Debounced updates (reduces Firebase writes)
- Only visible when scrolled to bottom

**Database Structure:**
```
globalChat/typing/{userId}: { userId, displayName, timestamp }
directMessages/{convId}/typing/{userId}: { userId, displayName, timestamp }
```

### Message Replies (Facebook/Messenger Style)
**Features:**
- Hover on message → Action bar appears (❤️, 😊, ↩️, ⋮)
- Click Reply → Reply bar shows above input
- Cancel reply with X button
- Reply indicator in messages shows quoted text
- Works in both Global Chat and Direct Messages

**Message Structure:**
```javascript
{
  text: "message",
  senderId: "uid",
  timestamp: 123456,
  replyTo: {
    messageId: "msgId",
    text: "original message",
    senderId: "originalUserId",
    senderName: "User Name"
  }
}
```

**UI Design:**
- Messenger-style dark rounded pill for action buttons
- White icons on semi-transparent dark background (90% opacity)
- Backdrop blur effect
- Positioned next to message bubble
- Your messages: Buttons to the left
- Their messages: Buttons to the right

### Instagram/Facebook-Style Conversation Deletion
**How it works:**
- Delete conversation → Stores deletion timestamp
- Only removes from YOUR view (other user unaffected)
- Old messages hidden for you (not deleted from database)
- Send new message → Conversation reappears with fresh start
- Only shows messages sent AFTER deletion timestamp
- If both users delete → Both see fresh start (using latest deletion time)

**Implementation:**
```
users/{userId}/deletedConversations/{convId}: timestamp
```

**Filter Logic:**
- `listenToDirectMessages` checks both users' deletion timestamps
- Uses `Math.max(myTime, theirTime)` for effective deletion time
- Only shows messages where `msg.timestamp > effectiveDeletionTime`
- Deletion timestamps never removed (permanent filter)

**UI:**
- Hover on conversation → Trash icon appears (replaces timestamp)
- Click → Professional modal confirmation (not browser alert)
- Modal rendered via React Portal
- Real-time list updates (no refresh needed)

### Unread Message Badges
**Features:**
- Red circular badges on chat tabs
- Global Chat tab → Shows unread global messages when on DM tab
- DM tab → Shows total unread DMs when on Global tab
- Main chat bubble → Shows total unread when chat closed
- Auto-resets when switching to that tab

**Tracking:**
- Uses existing Firebase `unreadCount` in conversation metadata
- Sums across all conversations for DM badge
- Detects new messages from others only (not your own)

### RTL (Right-to-Left) Support
**Arabic Text Handling:**
- `direction: 'rtl'` on message bubbles
- `textAlign: 'right'` for proper alignment
- Instagram-style font stack for better Arabic rendering
- `fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'`
- Natural text wrapping at word boundaries
- `max-w-sm` (384px) for comfortable reading width
- `leading-relaxed` for better line spacing

### Smart Auto-Scroll Behavior
**Rules:**
1. **Initial load** → Instant scroll to bottom ✅
2. **You send message** → Instant scroll to bottom ✅
3. **You scroll up** → Stay where you are (no auto-scroll) ✅
4. **Someone sends message while you're at bottom** → Instant scroll (debounced 300ms) ✅
5. **Someone sends message while you're scrolled up** → No scroll ✅
6. **Typing indicator while at bottom** → Instant scroll ✅
7. **Typing indicator while scrolled up** → No scroll ✅
8. **Load older messages** → Preserve scroll position ✅

**Implementation:**
- Real-time scroll position check (not state-based)
- Reads directly from `messagesContainerRef.current`
- Checks `scrollHeight - scrollTop - clientHeight < 200px`
- 300ms debounce to prevent multiple rapid scrolls
- Uses `behavior: 'instant'` for snappy feel (no smooth animation)

### Known Behaviors
**Expected:**
- Action buttons positioned next to messages (transparent, no background)
- Typing indicator appears as message bubble inside chat
- Profile updates reflect everywhere within 1 second
- Messages load in batches of 50 (pagination)
- Scroll to top triggers "Load older messages"
- Delete conversation modal via portal (always visible)
- Badges update in real-time across tabs
- Reactions show Facebook-style emojis (CDN-based)
- Text direction auto-detects (RTL for Arabic, LTR for English)

**Technical Decisions:**
- ImgBB for image uploads (no Firebase Storage billing)
- Profile cache in AuthContext (session-scoped, real-time listeners)
- Message pagination via Firebase queries (not client-side filtering)
- Deletion via timestamps (preserves data, filters views)
- Instant scroll for all auto-scrolls (no smooth animations)
- Facebook emoji CDN (emoji-datasource-facebook@15.0.1)
- One reaction per user per message (switches on different emoji)
- Unread badges track lastReadTimestamp (survives page refresh)

---
