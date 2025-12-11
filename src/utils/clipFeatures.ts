/**
 * CLIP Feature Extraction in the Browser
 * 
 * Uses Transformers.js to extract CLIP features from images in the browser.
 * The features are then sent to Convex for MLP classification.
 */

import { pipeline } from '@xenova/transformers';

let clipModel: any = null;

/**
 * Initialize CLIP model (lazy loading)
 */
async function getCLIPModel() {
  if (!clipModel) {
    console.log('Loading CLIP model...');
    clipModel = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
    console.log('✓ CLIP model loaded');
  }
  return clipModel;
}

/**
 * Extract CLIP features from an image file
 * @param imageFile - The image file (File object from input)
 * @returns 512-dimensional CLIP feature vector as Float32Array
 */
export async function extractCLIPFeatures(imageFile: File): Promise<Float32Array> {
  try {
    const model = await getCLIPModel();
    
    // Create object URL from file
    const imageUrl = URL.createObjectURL(imageFile);
    
    try {
      // Extract image features using pipeline
      const output = await model(imageUrl);
      
      // Convert to Float32Array
      // output.data should be a TypedArray or array
      const features = output.data instanceof Float32Array 
        ? output.data 
        : new Float32Array(output.data);
      
      return features;
    } finally {
      // Clean up object URL
      URL.revokeObjectURL(imageUrl);
    }
  } catch (error) {
    console.error('CLIP feature extraction error:', error);
    throw new Error(`Failed to extract CLIP features: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract CLIP features from an image URL
 * @param imageUrl - URL to the image
 * @returns 512-dimensional CLIP feature vector as Float32Array
 */
export async function extractCLIPFeaturesFromUrl(imageUrl: string): Promise<Float32Array> {
  try {
    const model = await getCLIPModel();
    
    // Extract image features using pipeline
    const output = await model(imageUrl);
    
    // Convert to Float32Array
    const features = output.data instanceof Float32Array 
      ? output.data 
      : new Float32Array(output.data);
    
    return features;
  } catch (error) {
    console.error('CLIP feature extraction error:', error);
    throw new Error(`Failed to extract CLIP features: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

