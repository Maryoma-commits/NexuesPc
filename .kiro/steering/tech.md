# NexusPC - Tech Stack

## Frontend

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS (via custom classes in index.html)
- **Icons**: Lucide React
- **Notifications**: react-hot-toast
- **Emoji Picker**: emoji-picker-react

## Backend

- **API**: FastAPI (Python)
- **Scraping**: BeautifulSoup4, Cloudscraper
- **Database**: Firebase Realtime Database
- **Auth**: Firebase Authentication (Email/Password + Google)
- **Image Hosting**: ImgBB API
- **Logging**: Custom logger module with Unicode/ASCII fallback support

## Testing

- **Framework**: Vitest with jsdom environment
- **Property Testing**: fast-check
- **UI Testing**: @vitest/ui

## Deployment

- **Frontend**: Vercel
- **Analytics**: @vercel/analytics, @vercel/speed-insights

## Key Features Added

- **Scraper Configuration**: `scraper_config.json` for enabling/disabling sites
- **Admin Dashboard**: HTML-based admin panel with real-time scraper control
- **Logger Module**: Clean console output with color support and Unicode fallbacks
- **Site Disabling**: Ability to disable specific retailers from scraping

## Common Commands

```bash
# Development
npm run dev          # Start Vite dev server (port 3000)

# Build
npm run build        # Production build

# Testing
npm run test         # Run tests once (vitest --run)
npm run test:watch   # Watch mode
npm run test:ui      # Vitest UI

# Backend (from /backend directory)
python main.py       # CLI scraper mode (interactive menu)
python main.py admin # Start FastAPI server with admin dashboard
uvicorn main:app --reload  # Dev server
```

## Environment Variables

Required in `.env`:
- `GEMINI_API_KEY` - For AI features
- `VITE_IMGBB_API_KEY` - For image uploads

Firebase config is in `firebase.config.ts`.

## Backend Configuration

- **Scraper Config**: `backend/scraper_config.json` - Enable/disable sites
- **Logger**: `backend/logger.py` - Handles console output formatting
- **Main API**: `backend/main.py` - FastAPI server with scraper endpoints
- **Scraper**: `backend/scraper.py` - Multi-site product aggregation
