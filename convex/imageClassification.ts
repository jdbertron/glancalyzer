"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { loadMLPWeights, mlpForward, type MLPWeights } from "./mlpForward";

// MLP weights cache
let mlpWeights: MLPWeights | null = null;

async function getMLPWeights(ctx: any): Promise<MLPWeights> {
  if (!mlpWeights) {
    mlpWeights = await loadMLPWeights(ctx);
  }
  return mlpWeights;
}

/**
 * Composition class names - must match your training code
 * From composition_classifier.py: COMPOSITIONS + ["no_composition"]
 */
const COMPOSITION_CLASSES = [
  "steelyard",
  "balanced_scales",
  "circular",
  "compound_curve",
  "diagonal",
  "cross",
  "radiating_line",
  "tunnel",
  "inverted_steelyard",
  "u_shaped",
  "triangle",
  "no_composition"
];

/**
 * Classify CLIP features using TypeScript MLP forward pass.
 * CLIP features are extracted in the browser and sent here.
 */
export const classifyFeatures = internalAction({
  args: {
    pictureId: v.id("pictures"),
    clipFeatures: v.array(v.number()), // 512-dimensional CLIP features
  },
  returns: v.object({
    success: v.boolean(),
    probabilities: v.optional(v.any()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      // Convert array to Float32Array
      const clipFeatures = new Float32Array(args.clipFeatures);
      
      if (clipFeatures.length !== 512) {
        throw new Error(`Expected 512 CLIP features, got ${clipFeatures.length}`);
      }
      
      // Load MLP weights and run forward pass
      const weights = await getMLPWeights(ctx);
      const sigmoidProbs = mlpForward(clipFeatures, weights);

      // Normalize sigmoid outputs to sum to 1 for multi-class interpretation
      const probsArray = Array.from(sigmoidProbs);
      const sum = probsArray.reduce((a, b) => a + b, 0);
      const normalizedProbs = sum > 0 
        ? probsArray.map(x => x / sum)
        : probsArray.map(() => 1 / probsArray.length); // Fallback: equal probabilities

      // Create result object with class names
      const result: Record<string, number> = {};
      COMPOSITION_CLASSES.forEach((className, index) => {
        result[className] = normalizedProbs[index] || 0;
      });

      // Store the results in the database
      await ctx.runMutation(internal.pictures.storeClassificationResults, {
        pictureId: args.pictureId,
        probabilities: result,
      });

      return {
        success: true,
        probabilities: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Image classification error:", errorMessage);
      console.error(error);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

// storeClassificationResults is now in pictures.ts (mutations can't be in "use node" files)

/**
 * Public action to classify CLIP features.
 * CLIP features are extracted in the browser and sent here.
 */
export const classifyImageFeatures = action({
  args: {
    pictureId: v.id("pictures"),
    clipFeatures: v.array(v.number()), // 512-dimensional CLIP features
  },
  returns: v.object({
    success: v.boolean(),
    probabilities: v.optional(v.any()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; probabilities?: any; error?: string }> => {
    // Check if already classified
    const picture: any = await ctx.runQuery(internal.pictures.getPictureInternal, {
      pictureId: args.pictureId,
    });

    if (!picture) {
      return {
        success: false,
        error: "Picture not found",
      };
    }

    if (picture.compositionProbabilities) {
      return {
        success: true,
        probabilities: picture.compositionProbabilities,
      };
    }

    // Classify using the provided features
    const result: { success: boolean; probabilities?: any; error?: string } = await ctx.runAction(internal.imageClassification.classifyFeatures, {
      pictureId: args.pictureId,
      clipFeatures: args.clipFeatures,
    });

    return result;
  },
});

