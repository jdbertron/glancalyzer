# Uploading MLP Weights to Convex Storage

## Why Upload to Storage?

The `mlp_weights.json` file is **4.8MB**, which is quite large for bundling with your Convex functions. Uploading it to Convex Storage:
- ✅ Reduces bundle size (faster deployments)
- ✅ Allows updating weights without redeploying
- ✅ Better for production environments

## Upload Steps

### Step 1: Upload the File

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Navigate to **Storage** in the left sidebar
3. Click **Upload** or **Upload File**
4. Select `mlp_weights.json` from your computer
5. Wait for upload to complete
6. **Copy the Storage ID** (looks like `k1234567890abcdef`)

### Step 2: Set Environment Variable

1. In Convex Dashboard, go to **Settings** → **Environment Variables**
2. Click **Add Variable**
3. Set:
   - **Name**: `MLP_WEIGHTS_STORAGE_ID`
   - **Value**: The storage ID from Step 1 (e.g., `k1234567890abcdef`)
4. Click **Save**

### Step 3: Deploy

The code is already updated to support storage! Just deploy:

```bash
npx convex deploy
```

## How It Works

The code will:
1. **First try** to load from Convex Storage (if `MLP_WEIGHTS_STORAGE_ID` is set)
2. **Fallback** to local file if storage is not configured or fails

This means:
- ✅ Works immediately with local file (for development)
- ✅ Automatically uses storage when configured (for production)
- ✅ No code changes needed after uploading

## Verification

After uploading and setting the environment variable:
1. Upload an image
2. Check Convex logs - you should see: `"✓ MLP weights loaded from Convex Storage"`
3. Classification should work normally

## Troubleshooting

**"Failed to load from storage"**
- Verify `MLP_WEIGHTS_STORAGE_ID` is set correctly
- Check that the storage ID exists in your Convex Storage
- The code will automatically fall back to local file

**"Missing required weight key"**
- The JSON file structure might be incorrect
- Re-run `python export_mlp_weights.py` to regenerate
