/**
 * MLP Forward Pass Implementation
 * 
 * This implements the forward pass of the PyTorch MLP classifier in TypeScript.
 * The weights are loaded from mlp_weights.json exported from Python.
 */

// MLP Architecture:
// Input: 512 (CLIP features)
// Layer 1: Linear(512 -> 256) + ReLU + Dropout(0.3) [Dropout disabled in inference]
// Layer 2: Linear(256 -> 128) + ReLU + Dropout(0.3) [Dropout disabled in inference]
// Layer 3: Linear(128 -> 12) + Sigmoid

export interface MLPWeights {
  [key: string]: {
    data: number[][];
    shape: number[];
  };
}

/**
 * Load MLP weights from JSON
 * 
 * Loads weights from Convex Storage (recommended for large files) or falls back to local file.
 * Set MLP_WEIGHTS_STORAGE_ID environment variable to use storage.
 */
export async function loadMLPWeights(ctx?: any): Promise<MLPWeights> {
  try {
    let weights: MLPWeights;
    
    // Try loading from Convex Storage first (if storage ID is set)
    const storageId = process.env.MLP_WEIGHTS_STORAGE_ID;
    if (storageId && ctx && ctx.storage) {
      try {
        // Convert string storage ID to Id<"_storage">
        const url = await ctx.storage.getUrl(storageId as any);
        if (url) {
          const response = await fetch(url);
          if (response.ok) {
            weights = await response.json() as MLPWeights;
            console.log("✓ MLP weights loaded from Convex Storage");
            return validateWeights(weights);
          }
        }
      } catch (storageError) {
        console.warn("Failed to load from storage, falling back to local file:", storageError);
      }
    }
    
    // Fallback: try local file (for development or if storage not configured)
    // Use dynamic import (works in both "use node" and regular Convex contexts)
    const weightsModule = await import("./mlp_weights.json");
    weights = (weightsModule.default || weightsModule) as MLPWeights;
    console.log("✓ MLP weights loaded from local file");
    
    return validateWeights(weights);
  } catch (error) {
    throw new Error(
      `Failed to load MLP weights: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      `Either upload mlp_weights.json to Convex Storage and set MLP_WEIGHTS_STORAGE_ID, ` +
      `or ensure mlp_weights.json exists in the convex/ directory. ` +
      `Run 'python export_mlp_weights.py' to generate it.`
    );
  }
}

/**
 * Validate MLP weights structure
 */
function validateWeights(weights: MLPWeights): MLPWeights {
  if (!weights || typeof weights !== 'object') {
    throw new Error("Invalid weights format");
  }
  
  // Check for required keys
  const requiredKeys = ['mlp.0.weight', 'mlp.0.bias', 'mlp.3.weight', 'mlp.3.bias', 'mlp.6.weight', 'mlp.6.bias'];
  for (const key of requiredKeys) {
    if (!weights[key]) {
      throw new Error(`Missing required weight key: ${key}`);
    }
  }
  
  return weights;
}

/**
 * Matrix multiplication: x @ W^T + b
 */
function linear(x: Float32Array, weight: number[][], bias: number[]): Float32Array {
  const [outFeatures, inFeatures] = [weight.length, weight[0].length];
  const result = new Float32Array(outFeatures);
  
  for (let i = 0; i < outFeatures; i++) {
    let sum = bias[i];
    for (let j = 0; j < inFeatures; j++) {
      sum += x[j] * weight[i][j];
    }
    result[i] = sum;
  }
  
  return result;
}

/**
 * ReLU activation: max(0, x)
 */
function relu(x: Float32Array): Float32Array {
  return new Float32Array(x.map(val => Math.max(0, val)));
}

/**
 * Sigmoid activation: 1 / (1 + exp(-x))
 */
function sigmoid(x: Float32Array): Float32Array {
  return new Float32Array(x.map(val => 1 / (1 + Math.exp(-val))));
}

/**
 * Forward pass through the MLP
 * @param features - CLIP features (512-dimensional)
 * @param weights - MLP weights loaded from JSON
 * @returns Classification probabilities (12-dimensional)
 */
export function mlpForward(features: Float32Array, weights: MLPWeights): Float32Array {
  // Layer 1: Linear(512 -> 256) + ReLU
  const layer1Weight = weights['mlp.0.weight'].data;
  const layer1Bias = weights['mlp.0.bias'].data;
  let x = linear(features, layer1Weight, layer1Bias);
  x = relu(x);
  // Dropout is disabled during inference (no-op)
  
  // Layer 2: Linear(256 -> 128) + ReLU
  const layer2Weight = weights['mlp.3.weight'].data;
  const layer2Bias = weights['mlp.3.bias'].data;
  x = linear(x, layer2Weight, layer2Bias);
  x = relu(x);
  // Dropout is disabled during inference (no-op)
  
  // Layer 3: Linear(128 -> 12) + Sigmoid
  const layer3Weight = weights['mlp.6.weight'].data;
  const layer3Bias = weights['mlp.6.bias'].data;
  x = linear(x, layer3Weight, layer3Bias);
  x = sigmoid(x);
  
  return x;
}

