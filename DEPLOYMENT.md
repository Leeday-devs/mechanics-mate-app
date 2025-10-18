# Deployment Guide

This guide covers deploying My Mechanic to various hosting platforms.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Platform-Specific Guides](#platform-specific-guides)
   - [Vercel](#vercel)
   - [Netlify](#netlify)
   - [Railway](#railway)
   - [Heroku](#heroku)
   - [Self-Hosted (VPS)](#self-hosted-vps)
4. [Post-Deployment](#post-deployment)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- [x] A valid Anthropic API key
- [x] (Optional) Google Search API credentials for forum search
- [x] Git repository set up
- [x] `.env` file configured locally (for testing)
- [x] `.gitignore` includes `.env` (security!)

---

## Environment Variables

All platforms require these environment variables:

### Required
```
ANTHROPIC_API_KEY=sk-ant-api03-your_key_here
```

### Optional
```
GOOGLE_SEARCH_API_KEY=your_google_api_key
SEARCH_ENGINE_ID=your_search_engine_id
PORT=3000
```

⚠️ **Never commit your `.env` file to Git!**

---

## Platform-Specific Guides

### Vercel

Vercel is great for serverless deployment with automatic HTTPS.

#### 1. Install Vercel CLI (optional)
```bash
npm i -g vercel
```

#### 2. Create `vercel.json`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    },
    {
      "src": "public/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/.*",
      "dest": "server.js"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}
```

#### 3. Update `server.js` for Vercel
```javascript
// At the end of server.js, replace app.listen with:
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`My Mechanic server running on http://localhost:${PORT}`);
    });
}

module.exports = app; // Export for Vercel
```

#### 4. Deploy
```bash
# Via CLI
vercel

# Or via GitHub integration:
# 1. Push to GitHub
# 2. Import project on vercel.com
# 3. Add environment variables in Vercel dashboard
# 4. Deploy
```

#### 5. Set Environment Variables
In Vercel dashboard:
- Go to Settings → Environment Variables
- Add `ANTHROPIC_API_KEY` and other vars
- Redeploy

---

### Netlify

Netlify provides easy deployment with serverless functions.

#### 1. Restructure for Netlify Functions
Create `netlify/functions/chat.js`:
```javascript
const serverless = require('serverless-http');
const app = require('../../server');

module.exports.handler = serverless(app);
```

#### 2. Create `netlify.toml`
```toml
[build]
  command = "npm install"
  functions = "netlify/functions"
  publish = "."

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### 3. Deploy
```bash
# Via CLI
npm install -g netlify-cli
netlify deploy --prod

# Or via GitHub:
# 1. Push to GitHub
# 2. Connect repo on netlify.com
# 3. Set build settings
# 4. Add environment variables
# 5. Deploy
```

---

### Railway

Railway offers simple deployment with persistent storage.

#### 1. Install Railway CLI
```bash
npm i -g @railway/cli
```

#### 2. Initialize Railway
```bash
railway login
railway init
```

#### 3. Add Environment Variables
```bash
railway variables set ANTHROPIC_API_KEY=sk-ant-api03-...
railway variables set GOOGLE_SEARCH_API_KEY=...
railway variables set SEARCH_ENGINE_ID=...
```

#### 4. Deploy
```bash
railway up
```

Railway will automatically:
- Detect Node.js
- Install dependencies
- Run `npm start`
- Assign a public URL

---

### Heroku

Heroku is a platform-as-a-service with free tier options.

#### 1. Install Heroku CLI
```bash
# macOS
brew tap heroku/brew && brew install heroku

# Ubuntu/Debian
curl https://cli-assets.heroku.com/install.sh | sh
```

#### 2. Create Heroku App
```bash
heroku login
heroku create my-mechanic-app
```

#### 3. Set Environment Variables
```bash
heroku config:set ANTHROPIC_API_KEY=sk-ant-api03-...
heroku config:set GOOGLE_SEARCH_API_KEY=...
heroku config:set SEARCH_ENGINE_ID=...
```

#### 4. Create `Procfile`
```
web: node server.js
```

#### 5. Deploy
```bash
git add .
git commit -m "Prepare for Heroku deployment"
git push heroku main
```

#### 6. Open App
```bash
heroku open
```

---

### Self-Hosted (VPS)

Deploy on your own VPS (DigitalOcean, Linode, AWS EC2, etc.).

#### 1. Set Up Server
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2
```

#### 2. Clone Repository
```bash
cd /var/www
git clone https://github.com/yourusername/my-mechanic.git
cd my-mechanic
npm install
```

#### 3. Configure Environment
```bash
nano .env
# Add your environment variables
```

#### 4. Start with PM2
```bash
pm2 start server.js --name my-mechanic
pm2 save
pm2 startup
```

#### 5. Set Up Nginx (Reverse Proxy)
```bash
sudo apt install nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/my-mechanic
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/my-mechanic /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 6. Add SSL with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Post-Deployment

### 1. Test the Deployment
- Visit your deployed URL
- Test PWA installation
- Try asking questions
- Test conversation export
- Verify offline functionality

### 2. Monitor Performance
```bash
# For PM2 deployments
pm2 monit

# Check logs
pm2 logs my-mechanic
```

### 3. Set Up Analytics (Optional)
Consider adding:
- Google Analytics
- Plausible Analytics
- Custom logging

### 4. Enable HTTPS
- Vercel/Netlify: Automatic
- Self-hosted: Use Let's Encrypt
- Always use HTTPS in production

---

## Troubleshooting

### API Key Issues
```
Error: Authentication error
```
**Solution**: Check that `ANTHROPIC_API_KEY` is set correctly in environment variables.

### Port Already in Use
```
Error: Port 3000 is already in use
```
**Solution**:
```bash
# Change PORT in environment variables
# Or kill the process using the port
lsof -ti:3000 | xargs kill
```

### Service Worker Not Updating
**Solution**:
1. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Unregister old service worker:
   ```javascript
   // In browser console
   navigator.serviceWorker.getRegistrations()
     .then(regs => regs.forEach(reg => reg.unregister()));
   ```

### Rate Limiting Issues
**Solution**: Adjust rate limits in `server.js`:
```javascript
max: 100, // Increase from 50
windowMs: 15 * 60 * 1000
```

### CORS Errors
**Solution**: Update CORS configuration in `server.js`:
```javascript
app.use(cors({
    origin: 'https://yourdomain.com',
    credentials: true
}));
```

---

## Security Checklist

Before deploying to production:

- [ ] Environment variables are set (not in code)
- [ ] `.env` is in `.gitignore`
- [ ] HTTPS is enabled
- [ ] Rate limiting is configured
- [ ] CORS is properly configured
- [ ] API key is rotated (if previously exposed)
- [ ] Dependencies are updated (`npm audit fix`)
- [ ] Error messages don't expose sensitive info

---

## Updating the Deployment

### For Git-Based Deployments
```bash
git pull origin main
npm install
pm2 restart my-mechanic  # if using PM2
```

### For Platform Deployments
- **Vercel/Netlify**: Push to GitHub (auto-deploys)
- **Railway**: `railway up`
- **Heroku**: `git push heroku main`

---

## Cost Estimates

### Free Tiers
- **Vercel**: 100GB bandwidth/month
- **Netlify**: 100GB bandwidth/month
- **Railway**: $5 free credit/month

### Anthropic API
- Pay per token used
- Monitor usage at console.anthropic.com

### Google Search API (Optional)
- 100 searches/day free
- $5 per 1000 queries after

---

## Need Help?

- Check the [README](README.md) for basic setup
- Review [SECURITY](SECURITY.md) for API key issues
- Open an issue on GitHub
- Check platform-specific documentation

---

## License

MIT License - See [LICENSE](LICENSE) file for details
