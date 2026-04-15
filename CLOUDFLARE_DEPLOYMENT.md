# Golden Bakery Code Manager - Cloudflare Deployment Guide

This guide will walk you through deploying the Golden Bakery Code Manager to Cloudflare Pages with a Cloudflare Worker backend and D1 database.

## Files Included

- **index.html** - Standalone HTML frontend with vanilla JavaScript
- **worker.js** - Cloudflare Worker API backend
- **wrangler.toml** - Cloudflare configuration file
- **CLOUDFLARE_DEPLOYMENT.md** - This guide

## Prerequisites

1. **Cloudflare Account** - Sign up at https://dash.cloudflare.com
2. **Node.js & npm** - Download from https://nodejs.org
3. **Wrangler CLI** - Install with: `npm install -g @cloudflare/wrangler`
4. **Git** (optional but recommended) - For version control

## Step-by-Step Deployment

### Step 1: Set Up Cloudflare Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Pages** in the sidebar
3. Click **Create a project** → **Connect to Git**
4. Select your GitHub repository where you'll push this code
5. Set up build configuration:
   - **Framework preset**: None
   - **Build command**: Leave empty (or any static file handler)
   - **Build output directory**: `/` (root, where index.html is)
6. Click **Save and Deploy**

> **Alternative**: If not using Git, you can upload files directly via the dashboard.

### Step 2: Create a D1 Database

1. In your Cloudflare Dashboard, go to **Storage & Databases** → **D1**
2. Click **Create database**
3. Name it: `golden-bakery-db`
4. Click **Create**
5. Copy your **Database ID** (you'll need this)

### Step 3: Set Up Cloudflare Workers

1. Install Wrangler if not already done:
   ```bash
   npm install -g @cloudflare/wrangler
   ```

2. Create a new Worker project:
   ```bash
   wrangler init golden-bakery-worker
   cd golden-bakery-worker
   ```

3. Replace the contents of `wrangler.toml` with the provided wrangler.toml file

4. Update `wrangler.toml`:
   - Replace `YOUR_DATABASE_ID` with your actual D1 Database ID
   - Replace `example.com` with your actual domain

5. Replace `src/index.js` with the provided `worker.js`

6. Create a `package.json` if not present:
   ```json
   {
     "name": "golden-bakery-worker",
     "version": "1.0.0",
     "scripts": {
       "deploy": "wrangler deploy"
     },
     "devDependencies": {
       "@cloudflare/wrangler": "^3.0.0"
     }
   }
   ```

### Step 4: Initialize the Database

1. Authenticate with Cloudflare:
   ```bash
   wrangler login
   ```

2. Deploy the Worker:
   ```bash
   wrangler deploy
   ```

3. Initialize the database by visiting:
   ```
   https://your-worker-name.your-domain.workers.dev/api/init
   ```
   You should see: `{"success":true,"message":"Database initialized"}`

### Step 5: Update HTML with API URL

Edit `index.html` and update this line:
```javascript
const API_URL = window.location.origin === 'file://' 
    ? 'https://your-worker.your-domain.workers.dev' 
    : `${window.location.origin}`;
```

**Option A: If using Pages subdomain**
```javascript
const API_URL = 'https://your-worker-name.your-domain.workers.dev';
```

**Option B: If using custom domain (recommended)**
- In `wrangler.toml`, set up route binding:
```toml
[[routes]]
pattern = "yourdomain.com/api/*"
zone_name = "yourdomain.com"
```

Then the API_URL can stay as:
```javascript
const API_URL = window.location.origin;
```

### Step 6: Deploy Everything

1. **Push to GitHub** (if using Git):
   ```bash
   git add .
   git commit -m "Initial commit: Golden Bakery Code Manager"
   git push origin main
   ```
   Cloudflare Pages will auto-deploy!

2. **Or upload directly to Pages**:
   - Drag and drop `index.html` to Cloudflare Pages dashboard

3. **Verify deployment**:
   - Visit your Pages URL
   - Try generating a code
   - Check that codes appear in the table

## Testing Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start local development:
   ```bash
   wrangler dev
   ```

3. Open `http://localhost:8787` in your browser

4. Make API calls to test:
   ```bash
   # Get all codes
   curl http://localhost:8787/api/codes

   # Create a code
   curl -X POST http://localhost:8787/api/codes \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","code":"GOLDEN123ABC456"}'
   ```

## API Endpoints

### GET /api/codes
Returns all unlock codes.

**Response:**
```json
[
  {
    "id": 1,
    "email": "customer@example.com",
    "code": "GOLDENABC123DEF456",
    "redeemed": 0,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

### POST /api/codes
Create a new unlock code.

**Request:**
```json
{
  "email": "customer@example.com",
  "code": "GOLDENABC123DEF456"
}
```

**Response:**
```json
{
  "success": true,
  "id": 1,
  "email": "customer@example.com",
  "code": "GOLDENABC123DEF456"
}
```

### PATCH /api/codes/:id
Mark a code as redeemed.

**Request:**
```json
{
  "redeemed": 1
}
```

**Response:**
```json
{
  "success": true
}
```

### DELETE /api/codes/:id
Delete a code.

**Response:**
```json
{
  "success": true
}
```

## Troubleshooting

### "Database not found" error
- Verify your Database ID in `wrangler.toml`
- Make sure you ran `/api/init` to initialize the database
- Check that the D1 binding is correctly configured

### CORS errors
- The Worker has CORS headers configured for all origins
- Make sure you're making requests to the correct API URL

### 404 errors on API calls
- Double-check your Worker URL is correct
- Verify the route patterns in `wrangler.toml`
- Check that your Worker is deployed

### Changes not showing up
- Clear browser cache
- Hard refresh with Ctrl+Shift+R (Cmd+Shift+R on Mac)
- Check CloudFlare Pages deployment logs

## Next Steps

### Add Authentication
Protect the API with API keys or Cloudflare Workers Auth.

### Add Rate Limiting
Prevent abuse by limiting requests per IP or email.

### Add Email Integration
Send codes automatically to customers via Mailgun or SendGrid.

### Custom Domain
Point your custom domain to Cloudflare Pages for a professional URL.

## Support & Resources

- **Cloudflare Pages Docs**: https://developers.cloudflare.com/pages/
- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **D1 Database Docs**: https://developers.cloudflare.com/d1/
- **Wrangler CLI Docs**: https://developers.cloudflare.com/workers/wrangler/

## License

This project is provided as-is for use with Cloudflare services.
