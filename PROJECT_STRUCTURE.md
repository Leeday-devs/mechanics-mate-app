# Project Structure

## Overview

This is a Node.js/Express backend with vanilla JavaScript frontend for an AI-powered automotive assistant. The project is organized for clean separation of concerns.

```
mechanics-mate-app/
├── public/                    # Frontend static files
│   ├── *.html                # HTML pages (login, signup, dashboard, etc.)
│   ├── *.css                 # Stylesheet
│   ├── *.svg                 # Icons and logo
│   ├── script.js             # Frontend chat logic
│   ├── service-worker.js     # PWA service worker
│   └── manifest.json         # PWA manifest
│
├── src/                       # Backend source code
│   ├── lib/                  # Core libraries
│   │   ├── supabase.js       # Supabase client initialization
│   │   ├── stripe.js         # Stripe client initialization
│   │   ├── pricing.js        # Plan pricing configuration
│   │   └── logger.js         # Application logging
│   │
│   ├── routes/               # API endpoint handlers
│   │   ├── auth.js           # Auth (signup, login, logout)
│   │   ├── subscriptions.js  # Subscription/payment endpoints
│   │   ├── admin.js          # Admin dashboard endpoints
│   │   └── logs.js           # Logging/audit endpoints
│   │
│   ├── middleware/           # Express middleware
│   │   ├── auth.js           # JWT auth + subscription checks
│   │   └── logger.js         # Request/error logging
│   │
│   └── utils/                # Utility functions
│       ├── quota.js          # Message quota tracking
│       ├── emailService.js   # Email sending (SendGrid)
│       ├── emailVerification.js  # Email verification flow
│       └── urlConfig.js      # URL configuration helper
│
├── database/                 # Database setup
│   ├── migrations/           # SQL migration scripts
│   │   ├── 001_*.sql        # Table creation
│   │   ├── 002_*.sql        # Bug fixes
│   │   └── ...
│   └── test-scripts/         # Test utilities
│
├── docs/                     # Documentation (archived)
│   ├── API_DOCUMENTATION.md
│   ├── DATABASE_SCHEMA.md
│   ├── DEPLOYMENT_RUNBOOK.md
│   └── ... (10 total docs)
│
├── netlify/                  # Netlify serverless functions
│   └── functions/            # Built by npm run build-functions
│
├── scripts/                  # Utility scripts
│   └── setup-test-accounts.js  # Test account creation
│
├── server.js                 # Express app entrypoint
├── package.json              # Dependencies & scripts
├── netlify.toml              # Netlify configuration
├── README.md                 # Main documentation
└── SECURITY.md               # Security guidelines

```

## Key Files

### Frontend Pages
- **public/index.html** - Chat interface
- **public/login.html** - Login page
- **public/signup.html** - Registration page
- **public/pricing.html** - Pricing/subscription page
- **public/dashboard.html** - User dashboard
- **public/loading.html** - Account setup loading page
- **public/admin.html** - Admin dashboard
- **public/landing.html** - Public landing page

### Backend Entry Points
- **server.js** - Express server initialization and route mounting
- **src/routes/** - API endpoint definitions (auth, subscriptions, admin, logs)

### Configuration
- **package.json** - Dependencies and build scripts
- **netlify.toml** - Netlify deployment configuration
- **.env** - Environment variables (not in git)

## Scripts

```bash
npm start          # Start development server
npm run dev        # Same as start
npm run build-functions  # Build Netlify functions
npm test          # Run tests (not yet implemented)
```

## Environment Setup

Required environment variables (see `.env.example`):
- `ANTHROPIC_API_KEY` - Claude API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `JWT_SECRET` - JWT signing secret
- `SENDGRID_API_KEY` - SendGrid email API key (optional)
- `SENTRY_DSN` - Sentry error tracking (optional)

## Development Workflow

### Adding a New API Endpoint
1. Create handler in `src/routes/[feature].js`
2. Add authentication middleware if needed (`authenticateToken`, `requireSubscription`)
3. Mount route in `server.js` with `app.use('/api/[feature]', require(...))`

### Adding a New Frontend Page
1. Create `public/[page].html`
2. Add Netlify redirect in `netlify.toml` if needed
3. Link from existing pages

### Database Changes
1. Create migration file in `database/migrations/`
2. Follow naming: `NNN_description.sql`
3. Execute migrations manually via Supabase dashboard

## Deployment

### To Netlify
1. Push to main branch on GitHub
2. Netlify automatically builds and deploys
3. Functions in `netlify/functions/` are served at `/.netlify/functions/[function]`

### Environment Variables
- Set in Netlify dashboard under Site settings → Build & deploy → Environment
- Netlify imports from `.env` during builds
- See `netlify.toml` for external module dependencies

## Database Architecture

Uses **Supabase (PostgreSQL)** with:
- Row-Level Security (RLS) on sensitive tables
- JWT-based authentication
- Real-time subscriptions (if needed)

See `docs/DATABASE_SCHEMA.md` for full schema.

## Security

- JWT tokens stored in localStorage
- CSRF protection on form submissions
- Rate limiting on auth endpoints
- Helmet.js for HTTP security headers
- CORS configured for Netlify domain
- Stripe webhook signature verification

See `SECURITY.md` for detailed guidelines.

## Troubleshooting

### Subscription Sync Issues
- See `docs/SUBSCRIPTION_FLOW_ANALYSIS.md`
- Loading page polls subscription status for 30 seconds
- Check webhook logs in admin panel

### Email Not Sending
- Verify SendGrid API key is set
- Check email templates in `src/utils/emailService.js`
- Review logs in Sentry or console

### Database Errors
- Check Netlify function logs
- Verify Supabase credentials
- Ensure migrations have run
- Check RLS policies aren't blocking access

## Migration Notes

**Recent changes** (v1.0.1):
- Reorganized file structure (backend → `src/`, frontend → `public/`)
- Removed Firebase dependency
- Added subscription loading page
- Created `docs/` folder for archived documentation
