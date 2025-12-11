# Build & Deploy to Hostinger

## Convex Deployments

- **Dev:** `dev:fantastic-penguin-512` → `https://fantastic-penguin-512.convex.cloud`
- **Prod:** `adept-crane-909` → `https://adept-crane-909.convex.cloud`

> **Note:** Your `.env.local` file (created/updated by `convex dev`) contains the dev deployment config and your `.env.production` has the production config.
> 
> **⚠️ Warning:** Running `convex dev` will modify your `.env.local` file. If you have custom values in there, they may be overwritten.


---

## Development (Local)

### Start development with dev deployment
```bash
# This automatically uses the dev deployment configured via convex dev  (concurrently updates convex and runs the dev code)
npm start
```

When you run `npm start`, it runs `convex dev` which:
- Uses the dev deployment configured in Convex's own config (stored separately, not in `.env.local`)
- **Writes the deployment URL to `.env.local`** so Vite can use it (this modifies the file)
- Automatically syncs functions to the dev deployment
- Watches for changes and auto-reloads

> **Note:** `convex dev` doesn't read from `.env.local` to know which deployment to use. It uses Convex's internal configuration (set when you first run `convex dev`). The `.env.local` file is **output** for the frontend, not **input** for the CLI.

### Deploy Convex functions to dev
```bash
# Just run convex dev - it automatically deploys to your configured dev deployment
npx convex dev
```

---

## Production Build & Deploy

### 1. Deploy Convex functions to production
```bash
# Deploy to production (adept-crane-909)
npx convex deploy
```

> **Note:** `convex deploy` always deploys to your production deployment by default. There's no way to make it deploy to dev - use `npx convex dev --once` for dev instead.

### 2. Build the frontend (pointing to production)
```bash
# With TypeScript checking
VITE_CONVEX_URL=https://adept-crane-909.convex.cloud npm run build

# OR skip TypeScript checking (faster)
VITE_CONVEX_URL=https://adept-crane-909.convex.cloud npm run build:skip-types
```

> **Important:** Always set `VITE_CONVEX_URL` when building for production!

---

## Deploy to Hostinger

### 3. Create the deployment zip
```bash
cd dist && 7za a ../dist.zip . && cd ..
```

### 4. Upload and extract on Hostinger

1. Upload `dist.zip` to `public_html/` via File Manager or FTP
2. In Hostinger File Manager: right-click `dist.zip` → **Extract**
3. Delete `dist.zip` after extraction (optional)

Your `public_html/` should look like:
```
public_html/
├── index.html
├── .htaccess        ← SPA routing for React Router
└── assets/
    └── (all JS/CSS/images)
```

> **⚠️ Important:** Extract directly in `public_html/`, not into a subfolder.

---

## Quick Reference

| Task | Command |
|------|---------|
| **Local dev (uses dev deployment)** | `npm start` |
| **Deploy Convex to dev** | `npx convex dev` (or `npm start` which includes this) |
| **Deploy Convex to prod** | `npx convex deploy` |
| **Deploy Convex to dev (one-time)** | `npx convex dev --once` |
| **Build frontend (dev)** | `VITE_CONVEX_URL=https://fantastic-penguin-512.convex.cloud npm run build` |
| **Build frontend (prod)** | `VITE_CONVEX_URL=https://adept-crane-909.convex.cloud npm run build` |

## How It Works

1. **Convex CLI** (`convex dev` / `convex deploy`):
   - `convex dev` automatically configures and uses your dev deployment (creates/updates `.env.local`)
   - `convex deploy` always deploys to production (no way to change this)
   - For one-time dev deployment, use `npx convex dev --once`

2. **Frontend** (`VITE_CONVEX_URL`):
   - Set as environment variable when building
   - Tells the React app which Convex deployment to connect to
   - **Dev:** `https://fantastic-penguin-512.convex.cloud`
   - **Prod:** `https://adept-crane-909.convex.cloud`

3. **Local Development:**
   - `npm start` runs `convex dev` which configures your dev deployment
   - Creates `.env.local` with the dev deployment URL
   - Vite automatically uses `.env.local` for `VITE_CONVEX_URL`



## J.D. Notes:

Vite's environment file loading:
.env - loaded in all modes
.env.local - loaded in all modes (git-ignored)
.env.[mode] - loaded only in that mode
.env.[mode].local - loaded only in that mode (git-ignored)

1. Vite confusing commands
The environment used is determined by:
vite dev → mode = development (loads .env.development, .env.local)
vite build → mode = production (loads .env.production, .env.production.local)

2. Convex confusing commands:
Dev: npx convex dev --once (or just npx convex dev to watch)
Prod: npx convex deploy