# Native Modules Issue in Convex

## The Problem

Convex's bundler (esbuild) cannot handle native Node.js modules (`.node` files). When deploying, you get errors like:

```
✘ [ERROR] No loader is configured for ".node" files: node_modules/onnxruntime-node/bin/napi-v6/linux/x64/onnxruntime_binding.node
```

This happens even with:
- Dynamic imports (`await import("onnxruntime-node")`)
- `"use node";` directive
- Bundler configuration in `convex.json`

## Why This Happens

The bundler analyzes the entire dependency tree, including transitive dependencies. Even though `@xenova/transformers` is used, it has `onnxruntime-node` as a dependency, which contains native `.node` files.

## Potential Solutions

### Option 1: Use a Separate Service (Recommended)

Run the ONNX inference in a separate service (Python HTTP service, AWS Lambda, etc.) and call it from Convex:

```typescript
// In Convex action
const response = await fetch("https://your-ml-service.com/classify", {
  method: "POST",
  body: imageBuffer,
});
```

**Pros:**
- Works around Convex limitations
- Can use full Python ML stack
- Better performance for large models

**Cons:**
- Additional infrastructure
- Network latency
- More complex deployment

### Option 2: Use Pure JavaScript Alternatives

- **onnxruntime-web**: Browser-based, pure JavaScript, but may not work in Node.js
- **TensorFlow.js**: Pure JavaScript ML runtime
- **ML.js**: Pure JavaScript machine learning library

**Pros:**
- No native modules
- Works in Convex

**Cons:**
- May have performance limitations
- May not support all ONNX operations
- May require model conversion

### Option 3: Wait for Convex Support

Convex may add support for native modules in the future. Check:
- Convex documentation
- Convex GitHub issues
- Convex Discord/community

### Option 4: Use @xenova/transformers Only

If `@xenova/transformers` can load your custom ONNX model directly, you might not need `onnxruntime-node`:

```typescript
// Check if @xenova/transformers can load custom models
const { AutoModel } = await import("@xenova/transformers");
// Try loading your model
```

**Pros:**
- Uses existing dependency
- Might work if transformers supports it

**Cons:**
- May not support custom ONNX models
- Limited to transformers-compatible models

## Current Status

- ❌ `onnxruntime-node` - Native module, not supported
- ❌ `sharp` - Native module, may have same issue
- ✅ `@xenova/transformers` - Works (but has native dependency internally)
- ❓ Custom ONNX model inference - Blocked by native module requirement

## Next Steps

1. **Short term**: Use a separate Python HTTP service for ONNX inference
2. **Long term**: Monitor Convex updates for native module support
3. **Alternative**: Convert model to TensorFlow.js format and use TF.js

## References

- [Convex Actions Documentation](https://docs.convex.dev/functions/actions)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- [TensorFlow.js](https://www.tensorflow.org/js)

