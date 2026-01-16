# NexusPC - Product Overview

NexusPC is a PC component price aggregator and community platform for the Iraqi market. It helps users find and compare PC hardware prices across multiple Iraqi retailers with an integrated admin dashboard for managing scrapers.

## Core Features

- **Product Aggregation**: Scrapes and displays PC components from 9+ Iraqi retailers (GlobalIraq, Alityan, Kolshzin, 3D-Iraq, JokerCenter, Almanjam, Spniq, Galaxy IQ, Altajit)
- **PC Builder**: Interactive tool for building custom PC configurations with compatibility checking
- **Community Features**: Social feed with posts, comments, reactions, and user following
- **Real-time Chat**: Global chat and direct messaging between users
- **User Profiles**: Authentication, profiles, favorites, and notifications
- **Admin Dashboard**: Web-based control panel for managing scrapers, viewing logs, and controlling product data
- **Scraper Configuration**: Enable/disable specific retailers without code changes

## Target Users

Iraqi PC enthusiasts and builders looking to compare component prices across local retailers and share builds with the community.

## Key Integrations

- Firebase (Auth, Realtime Database)
- ImgBB (image hosting for chat/posts)
- Vercel (hosting, analytics)
- FastAPI (backend API)

## Recent Updates

- **Logger Module**: Clean, organized console output with Unicode/ASCII fallback support
- **Scraper Config**: JSON-based configuration for enabling/disabling sites
- **Admin Dashboard**: Real-time scraper control and product management
- **Site Disabling**: Galaxy IQ and Altajit currently disabled (configurable)
- **Clean Output**: Organized scraper logs with store icons and progress tracking
