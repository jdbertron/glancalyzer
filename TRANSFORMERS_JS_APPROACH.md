# Transformers.js + TypeScript MLP Approach

This approach uses **Transformers.js** for CLIP feature extraction and a **pure TypeScript MLP forward pass** for classification. This is simpler and more reliable than converting models to TensorFlow.js.

## How It Works

1. **CLIP Feature Extraction**: Uses `@xenova/transformers` (already installed) to extract 512-dimensional features from images
2. **MLP Classification**: Implements the MLP forward pass directly in TypeScript using exported weights from PyTorch
3. **No Model Conversion**: No need to convert CLIP or MLP to TensorFlow.js/ONNX

## Setup Steps

### Step 1: Export MLP Weights from PyTorch

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

## Files Created/Updated

1. **`export_mlp_weights.py`** - Exports PyTorch MLP weights to JSON
2. **`convex/mlpForward.ts`** - Implements MLP forward pass in TypeScript
3. **`convex/imageClassification.ts`** - Updated to use Transformers.js for CLIP and TypeScript MLP

## How It Works

### CLIP Feature Extraction

```typescript
// Uses Transformers.js pipeline API
const model = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
const features = await model(imageUrl);
```

### MLP Forward Pass

```typescript
// Load weights from JSON
const weights = await loadMLPWeights();

// Run forward pass
const probabilities = mlpForward(clipFeatures, weights);
```

The MLP implementation includes:
- Linear layers (matrix multiplication + bias)
- ReLU activation
- Sigmoid activation (final layer)
- Dropout is disabled during inference (as expected)

## Advantages

✅ **No model conversion needed** - Works directly with PyTorch weights
✅ **Pure JavaScript** - No native modules, works in Convex
✅ **Simpler** - No TensorFlow.js/ONNX conversion complexity
✅ **Easier to debug** - Can inspect weights and forward pass in TypeScript
✅ **Faster iteration** - Update weights without re-converting models

## Model Architecture

The MLP structure (as implemented in `mlpForward.ts`):
- Input: 512 (CLIP features)
- Layer 1: Linear(512 → 256) + ReLU + Dropout(0.3) [disabled in inference]
- Layer 2: Linear(256 → 128) + ReLU + Dropout(0.3) [disabled in inference]
- Layer 3: Linear(128 → 12) + Sigmoid
- Output: 12 probabilities (normalized to sum to 1)

## Testing

After deploying, upload an image and it will automatically classify using:
1. Transformers.js CLIP for feature extraction
2. TypeScript MLP for classification

## Troubleshooting

### "MLP weights not found"
- Make sure `mlp_weights.json` is in the `convex/` directory
- Run `export_mlp_weights.py` if you haven't already

### "CLIP model loading failed"
- Transformers.js will download the model on first use
- Check your internet connection
- The model is cached after first download

### Classification results are still uniform
- Verify `mlp_weights.json` was exported correctly
- Check Convex logs for errors during feature extraction or forward pass
- Ensure the weights match your training architecture

