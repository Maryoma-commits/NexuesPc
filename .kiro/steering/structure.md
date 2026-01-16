# NexusPC - Project Structure

## Root Layout

```
/
├── components/       # React components
├── services/         # Business logic & Firebase operations
├── contexts/         # React contexts (AuthContext)
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
├── constants/        # App constants (admin config)
├── backend/          # Python FastAPI backend & scrapers
├── public/           # Static assets & product data
├── src/test/         # Vitest test files
├── chrome-extension/ # Browser extension for price tracking
├── .kiro/            # Kiro configuration and steering
└── admin_dashboard.html  # Admin panel for scraper management
```

## Key Directories

### `/components`
- `admin/` - Admin dashboard components (user management, moderation)
- `auth/` - Authentication modals, user menu, profile
- `chat/` - Global chat, DMs, chat bubbles
- `community/` - Social feed, posts, comments
- `ui/` - Reusable UI components (buttons, toggles)

### `/services`
Firebase service layer - each file handles a specific domain:
- `authService.ts` - Authentication & user profiles
- `chatService.ts` - Global chat & direct messages
- `postService.ts` - Community posts CRUD
- `commentService.ts` - Post comments
- `notificationService.ts` - User notifications
- `followService.ts` - User following system
- `dataService.ts` - Product data loading

### `/backend`
- `main.py` - FastAPI server & CLI interface with scraper config support
- `scraper.py` - Multi-site product scraper (9+ retailers)
- `price_utils.py` - Price normalization utilities
- `logger.py` - Clean console logging with Unicode/ASCII support
- `scraper_config.json` - Configuration for enabling/disabling sites

### `/types`
- `types.ts` - Core types (Product, SearchState)
- `community-posts.ts` - Community feature types

### `/.kiro`
- `steering/` - Agent guidance documents (tech.md, structure.md, product.md)
- `settings/` - MCP configuration

## Entry Points

- `index.tsx` - React app entry
- `App.tsx` - Main app component with routing
- `firebase.config.ts` - Firebase initialization
- `admin_dashboard.html` - Admin panel for scraper management
- `backend/main.py` - Backend API and CLI

## Data Flow

1. Products scraped by backend → saved to `public/data/products.json`
2. Frontend loads products via `dataService.ts`
3. User data stored in Firebase Realtime Database
4. Images uploaded to ImgBB, URLs stored in Firebase
5. Admin dashboard controls scraper via `/scraper-config` API

## Scraper Configuration

- **Config File**: `backend/scraper_config.json`
- **Enabled Sites**: GlobalIraq, Alityan, Kolshzin, 3D-Iraq, JokerCenter, Spniq, Almanjam
- **Disabled Sites**: Galaxy IQ, Altajit (can be toggled in config)
- **API Endpoints**:
  - `GET /scraper-config` - Get current config
  - `POST /scraper-config` - Update config
  - `POST /scrape` - Scrape all enabled sites
  - `POST /scrape/{site}` - Scrape single site (if enabled)
