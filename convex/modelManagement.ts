import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Upload the ONNX model to Convex storage.
 * Call this once after converting your PyTorch model to ONNX.
 * 
 * Usage from frontend:
 * 1. Convert model: python convert_to_onnx.py
 * 2. Upload the .onnx file using this mutation
 * 3. Set COMPOSITION_MODEL_STORAGE_ID environment variable with the returned fileId
 */
export const uploadModel = mutation({
  args: {
    fileName: v.string(),
    fileId: v.id("_storage"),
  },
  returns: v.object({
    fileId: v.id("_storage"),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Verify the file exists in storage
    const fileUrl = await ctx.storage.getUrl(args.fileId);
    if (!fileUrl) {
      throw new Error("File not found in storage");
    }

    return {
      fileId: args.fileId,
      message: `Model uploaded successfully. Set COMPOSITION_MODEL_STORAGE_ID=${args.fileId} in Convex environment variables.`,
    };
  },
});

/**
 * Get the current model file ID (for debugging)
 */
export const getModelInfo = query({
  args: {},
  returns: v.object({
    modelFileId: v.union(v.string(), v.null()),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const modelFileId = process.env.COMPOSITION_MODEL_STORAGE_ID;
    return {
      modelFileId: modelFileId || null,
      message: modelFileId 
        ? "Model is configured" 
        : "Model not configured. Set COMPOSITION_MODEL_STORAGE_ID environment variable.",
    };
  },
});

