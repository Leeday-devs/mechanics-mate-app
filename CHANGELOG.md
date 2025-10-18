# Changelog

All notable changes to My Mechanic will be documented in this file.

## [2.0.0] - 2025-10-18

### Added - Major PWA & Production Readiness Update

#### PWA & Offline Support
- **Service Worker**: Full offline support with intelligent caching strategies
  - Static assets cached on install for instant loading
  - Runtime caching for dynamic content
  - Offline fallback for API requests with helpful error messages
  - Automatic cache versioning and cleanup
- **PWA Manifest**: Enhanced with proper scope, shortcuts, and categories
- **Installation Prompt**: Detect and handle PWA installation with deferred prompts
- **Update Detection**: Automatic service worker update checks with user prompts

#### Icons & Visual Improvements
- **Custom SVG Icons**: Professional wrench & gear themed icons throughout
  - Top bar logo with animated wrench and gear design
  - Export button (download arrow icon)
  - Clear button (X icon)
  - Send button (arrow icon)
  - Welcome section large icon
- **PWA Icons**: Created 192x192 and 512x512 SVG icons for PWA support
- **Suggestion Card Icons**: Emoji icons for better visual appeal
  - ⚠️ Engine Management Light
  - 🔧 Service Schedule
  - 🔋 Car Won't Start
  - 🛞 Tyre Maintenance

#### User Experience
- **Vehicle Preset Saving**: Automatically saves and restores vehicle selection
  - Saved to localStorage
  - Restored on page reload
  - Updates automatically on any selector change
- **Typing Indicator**: Beautiful 3-dot bouncing animation while AI responds
  - Appears in chat area
  - Smooth animations
  - Auto-removed when response arrives
- **Enhanced Error Recovery**: Intelligent error handling with actionable messages
  - Timeout errors with retry suggestions
  - Connection errors with troubleshooting steps
  - Rate limit errors with wait time
  - Authentication errors with fix instructions
  - Service unavailable errors with retry option

#### Production & Deployment
- **Environment-Aware API**: Automatically detects localhost vs production
  - No manual configuration needed
  - Works seamlessly across environments
- **DEPLOYMENT.md**: Comprehensive deployment guide for:
  - Vercel (serverless)
  - Netlify (serverless functions)
  - Railway (platform-as-a-service)
  - Heroku (platform-as-a-service)
  - Self-hosted VPS (with PM2 & Nginx)
- **SECURITY.md**: Complete security documentation
  - API key rotation instructions
  - Security best practices
  - What to do if key is compromised
  - Production security checklist

#### Developer Experience
- **CHANGELOG.md**: This file for tracking all changes
- **Updated README.md**: Comprehensive documentation of all features
- **Better Code Organization**: Improved comments and structure
- **PWA Install Detection**: Helper functions to detect if running as PWA

### Changed

#### script.js
- Refactored API URL to be environment-aware
- Added service worker registration and update handling
- Added vehicle preset save/load functions
- Added typing indicator functions (show/hide)
- Enhanced error messages with detailed troubleshooting
- Improved error recovery with retry logic
- Updated resetChat() to use new icons

#### style.css
- Added typing indicator animations
- Updated icon placeholder classes to use real icons
- Improved accessibility (reduced motion support)
- Enhanced mobile responsiveness

#### manifest.json
- Added multiple icon sizes with proper purposes
- Added scope and shortcuts
- Enhanced PWA metadata

#### index.html
- Replaced all placeholder icons with SVG/emoji icons
- Updated send button icon
- Updated export button icon
- Updated clear button icon

### Fixed
- Service worker now properly caches all static assets
- Error messages now provide actionable information
- Vehicle selection persists across page reloads
- Icons display correctly on all devices

### Security
- Added SECURITY.md with API key rotation guide
- Added warnings about exposed API keys
- Added best practices for production deployment

## [1.0.0] - 2024-10-17

### Initial Release

#### Core Features
- Claude Sonnet 4.5 AI integration
- UK-specific automotive knowledge base
- Mobile-first responsive design
- Racing-themed dark UI (red/gold)
- Vehicle-specific assistance
- 31 UK/European car manufacturers
- Dynamic model selection

#### Functionality
- Real-time forum search (optional)
- Conversation export (TXT/JSON)
- Auto-save conversations (24h)
- Conversation recovery
- Rate limiting (50 req/15min, 10 chat/min)
- Enhanced markdown rendering
- Random car loading animations

#### UI/UX
- Touch-friendly 44x44px buttons
- Responsive breakpoints (640px, 1024px, 1440px)
- Smooth animations
- Safe area support for notched devices
- Accessibility features (reduced motion, high contrast)

---

## Version Format

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

Format: `[MAJOR.MINOR.PATCH] - YYYY-MM-DD`
