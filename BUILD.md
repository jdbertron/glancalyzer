# Build & Deploy to Hostinger

## Production Convex Deployment
- **Deployment:** `adept-crane-909`
- **URL:** `https://adept-crane-909.convex.cloud`

---

## Build Commands

### 1. Deploy Convex functions to production (if changed)
```bash
npx convex deploy --prod --deployment adept-crane-909
```

### 2. Build the frontend
```bash
VITE_CONVEX_URL=https://adept-crane-909.convex.cloud npx vite build
```

> **Note:** This skips TypeScript checking. To include type checking, use:
> ```bash
> VITE_CONVEX_URL=https://adept-crane-909.convex.cloud npm run build
> ```

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

## Local Development

```bash
npm run start
```

This runs both Convex dev server and Vite dev server concurrently.

