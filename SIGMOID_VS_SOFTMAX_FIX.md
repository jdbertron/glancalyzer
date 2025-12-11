# Sigmoid vs Softmax Issue

## The Problem

In `convert_to_onnx.py` (lines 98-101), the model has a **Sigmoid** activation at the end, but the Convex code applies **Softmax**. This is a mismatch:

- **Sigmoid**: Outputs values in [0,1] range, but they don't sum to 1. Used for **multi-label** classification (each class is independent).
- **Softmax**: Outputs probabilities that sum to 1. Used for **multi-class** classification (mutually exclusive classes).

Your model has **12 classes** that are **mutually exclusive** (an image has one composition type), so this should be **multi-class** with **softmax**, not sigmoid.

## What I Changed

I removed the `nn.Sigmoid()` from line 101 in `convert_to_onnx.py`. Now the model outputs **raw logits**, and the Convex code correctly applies softmax.

## Important: Check Your Original Model

**Before using the updated conversion script**, you need to verify:

1. **Was your original model trained with sigmoid or without?**
   - Check your training code (`composition_classifier.py`)
   - If it was trained WITH sigmoid, removing it will break the model
   - If it was trained WITHOUT sigmoid (just logits), then the fix is correct

2. **If your model WAS trained with sigmoid:**
   - You have two options:
     - **Option A**: Keep sigmoid in the model, but change Convex code to NOT apply softmax (just use sigmoid outputs directly)
     - **Option B**: Retrain the model without sigmoid (output logits), then use softmax

## How to Check

Run this to see what your original model outputs:

```python
import torch
model = torch.load('composition_classifier.pt', map_location='cpu')
# Or load state_dict and reconstruct

# Test with dummy input
dummy = torch.randn(1, 512)
output = model(dummy)
print("Output shape:", output.shape)
print("Output range:", output.min().item(), "to", output.max().item())
print("Output sum:", output.sum().item())

# If sum is close to 1.0, it's using softmax
# If each value is in [0,1] but sum > 1, it's using sigmoid
# If values can be negative or > 1, it's raw logits
```

## Current Status

- ✅ Removed `nn.Sigmoid()` from conversion script
- ✅ Convex code applies softmax (correct for multi-class)
- ⚠️ **You need to verify your original model architecture**

## Next Steps

1. Check your original training code to see if sigmoid was used
2. If sigmoid was used, either:
   - Keep the old conversion script (with sigmoid) and update Convex code
   - Or retrain without sigmoid
3. Re-run `python convert_to_onnx.py` with the updated script
4. Test the ONNX model to ensure it works correctly

