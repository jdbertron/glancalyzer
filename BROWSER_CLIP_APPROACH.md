# Browser CLIP + Convex MLP Approach

This approach runs **CLIP in the browser** and sends the features to **Convex for MLP classification**. This keeps the proprietary MLP model on the server while distributing CLIP inference to clients.

## Architecture

```
Browser                          Convex
  │                                │
  ├─ Upload Image                  │
  ├─ Extract CLIP Features ────────┼─ Receive Features
  │  (Transformers.js)              │
  │                                 ├─ Load MLP Weights
  │                                 ├─ Run Forward Pass
  │                                 ├─ Store Results
  └─ Display Results ◄──────────────┘
```

## Benefits

✅ **Reduced Server Load** - CLIP inference happens in the browser
✅ **Privacy** - Images never leave the browser for CLIP processing
✅ **Proprietary Model Protection** - MLP stays on Convex server
✅ **Faster** - No need to download image to Convex for CLIP
✅ **Scalable** - CLIP load distributed across clients

## Setup Steps

### Step 1: Export MLP Weights

Run the export script to extract weights from your trained model:

```bash
python export_mlp_weights.py
```

This creates `mlp_weights.json` containing all layer weights and biases.

### Step 2: Copy Weights to Convex

Copy `mlp_weights.json` to your `convex/` directory:

```bash
cp mlp_weights.json convex/
```

### Step 3: Deploy

The code is already updated! Just deploy:

```bash
npx convex deploy
```

## How It Works

### Browser Side (Upload.tsx)

1. User uploads image
2. Image is uploaded to Convex storage
3. **CLIP features are extracted in the browser** using `extractCLIPFeatures()`
4. Features (512 numbers) are sent to Convex via `classifyImageFeatures` action

### Convex Side (imageClassification.ts)

1. Receives CLIP features (512-dimensional array)
2. Loads MLP weights from `mlp_weights.json`
3. Runs forward pass using TypeScript implementation
4. Stores classification results in database

## Files

### Browser
- **`src/utils/clipFeatures.ts`** - CLIP feature extraction using Transformers.js
- **`src/pages/Upload.tsx`** - Updated to extract features and call Convex

### Convex
- **`convex/mlpForward.ts`** - MLP forward pass implementation
- **`convex/imageClassification.ts`** - Receives features and runs classification
- **`convex/mlp_weights.json`** - MLP weights (exported from PyTorch)

## API

### Browser: Extract CLIP Features

```typescript
import { extractCLIPFeatures } from '../utils/clipFeatures';

const features = await extractCLIPFeatures(imageFile);
// Returns: Float32Array of 512 CLIP features
```

### Convex: Classify Features

```typescript
const result = await classifyImageFeatures({
  pictureId: pictureId,
  clipFeatures: Array.from(features), // Convert Float32Array to array
});
```

## Model Architecture

### CLIP (Browser)
- Model: `Xenova/clip-vit-base-patch32`
- Input: Image file
- Output: 512-dimensional feature vector

### MLP (Convex)
- Input: 512 CLIP features
- Layer 1: Linear(512 → 256) + ReLU + Dropout(0.3) [disabled in inference]
- Layer 2: Linear(256 → 128) + ReLU + Dropout(0.3) [disabled in inference]
- Layer 3: Linear(128 → 12) + Sigmoid
- Output: 12 probabilities (normalized to sum to 1)

## Testing

1. Upload an image
2. Browser extracts CLIP features (you'll see "Extracting image features..." toast)
3. Features are sent to Convex
4. Convex runs MLP classification
5. Results are stored and displayed

## Troubleshooting

### "CLIP model loading failed"
- Transformers.js downloads the model on first use (may take a minute)
- Check browser console for errors
- Model is cached after first download

### "MLP weights not found"
- Make sure `mlp_weights.json` is in the `convex/` directory
- Run `export_mlp_weights.py` if you haven't already

### "Expected 512 CLIP features, got X"
- CLIP model may have output a different size
- Check the CLIP model version matches `Xenova/clip-vit-base-patch32`
- Verify feature extraction is working correctly

### Classification results are uniform
- Verify `mlp_weights.json` was exported correctly
- Check that CLIP features are being extracted (not all zeros)
- Review Convex logs for MLP forward pass errors

## Performance Considerations

- **First Load**: CLIP model download (~150MB) - happens once, then cached
- **Feature Extraction**: ~1-2 seconds per image (depends on device)
- **Classification**: ~50-100ms (very fast, just matrix math)

## Security

- CLIP features are sent over HTTPS
- MLP weights stay on Convex server (never exposed to client)
- Images are processed locally for CLIP, only features are transmitted

