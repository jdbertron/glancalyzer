# Troubleshooting Upload Issues

## Current Setup
- **Convex Backend**: http://localhost:3210 (Docker)
- **Convex Dashboard**: http://localhost:6791 (Docker)
- **React Frontend**: http://localhost:3000 (npm)
- **Environment Variable**: `VITE_CONVEX_URL=http://localhost:3210`

## How to Check if Upload Works

### 1. Access the Upload Page
1. Visit http://localhost:3000
2. Click "Try It Now" button
3. You should see the upload page

### 2. Try Uploading a File
1. Select a JPG or PNG image
2. Click "Upload Image"
3. Watch for success/error messages

### 3. Check Convex Dashboard
1. Visit http://localhost:6791
2. Look for "Data" tab in the left sidebar
3. Check if `pictures` table has entries
4. Check if `_storage` shows uploaded files

### 4. Check Browser Console
1. Press F12 in your browser
2. Go to "Console" tab
3. Look for any errors (red messages)
4. Check "Network" tab for failed requests

### 5. Check Backend Logs
```bash
docker compose logs backend --follow
```
Look for POST requests to `/api/mutation` or `/api/storage`

## Common Issues

### Issue: "Page is blank"
- **Cause**: React app not loading
- **Fix**: Restart React: `pkill -f "npm run dev" && npm run dev`

### Issue: "Upload fails silently"
- **Cause**: Convex client not connecting
- **Fix**: Check browser console for connection errors

### Issue: "CORS errors"
- **Cause**: Frontend can't connect to backend
- **Fix**: Should be auto-configured, check backend logs

### Issue: "Nothing in dashboard"
- **Cause**: No data uploaded yet OR connection issue
- **Fix**: Try uploading a file, then refresh dashboard

## Manual Test
Run this in browser console (F12):
```javascript
// Check Convex connection
console.log('Convex URL:', window.localStorage.getItem('VITE_CONVEX_URL'));
```

## Database Tables
Expected tables after deployment:
- `users` - User accounts
- `pictures` - Uploaded images
- `experiments` - AI experiments
- `emailVerificationTokens` - Email verification
- `rateLimits` - Rate limiting
- `membershipTiers` - Subscription tiers
- `_storage` - File storage (special Convex table)

