/**
 * CLIP Feature Extraction in the Browser
 * 
 * Uses Transformers.js to extract CLIP features from images in the browser.
 * The features are then sent to Convex for MLP classification.
 */

import { pipeline, env } from '@xenova/transformers';

// Configure Transformers.js for browser usage
// Use IndexedDB for caching (default in browser)
env.allowLocalModels = false;
env.allowRemoteModels = true;

// Enable verbose logging to debug model loading
env.verbose = true;

let clipModel: any = null;
let modelLoadError: Error | null = null;

/**
 * Clear the model cache (useful if cache is corrupted)
 * Transformers.js may use IndexedDB, Cache API, localStorage, or sessionStorage
 * 
 * This can be called manually if you're experiencing model loading issues.
 */
export async function clearModelCache() {
  try {
    console.log('Clearing Transformers.js model cache...');
    
    // 1. Clear IndexedDB databases
    try {
      const databases = await indexedDB.databases?.() || [];
      console.log('Found IndexedDB databases:', databases.map(db => db.name));
      
      const clearPromises = databases
        .map(db => db.name)
        .filter(name => {
          if (!name) return false;
          const lower = name.toLowerCase();
          return lower.includes('transformers') ||
                 lower.includes('xenova') ||
                 lower.includes('hf-') ||
                 lower.includes('huggingface');
        })
        .map(dbName => {
          console.log(`Clearing IndexedDB: ${dbName}`);
          return new Promise<void>((resolve) => {
            const deleteReq = indexedDB.deleteDatabase(dbName!);
            deleteReq.onsuccess = () => {
              console.log(`✓ Cleared IndexedDB: ${dbName}`);
              resolve();
            };
            deleteReq.onerror = () => {
              console.warn(`Failed to clear ${dbName}:`, deleteReq.error);
              resolve();
            };
            deleteReq.onblocked = () => {
              setTimeout(() => resolve(), 100);
            };
          });
        });
      
      await Promise.all(clearPromises);
    } catch (error) {
      console.warn('Error clearing IndexedDB:', error);
    }
    
    // 2. Clear Cache API (Cache Storage) - clear ALL caches and their entries
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        console.log('Found Cache API caches:', cacheNames);
        
        // First, delete all entries from each cache, then delete the cache itself
        const cachePromises = cacheNames.map(async (cacheName) => {
          try {
            console.log(`Clearing Cache API: ${cacheName}`);
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            console.log(`  Found ${keys.length} entries in ${cacheName}`);
            
            // Delete all entries
            await Promise.all(keys.map(key => cache.delete(key)));
            
            // Then delete the cache itself
            await caches.delete(cacheName);
            console.log(`✓ Cleared Cache API: ${cacheName}`);
          } catch (err) {
            console.warn(`Error clearing cache ${cacheName}:`, err);
            // Fallback: try to delete the cache directly
            try {
              await caches.delete(cacheName);
            } catch (e) {
              console.warn(`Failed to delete cache ${cacheName}:`, e);
            }
          }
        });
        
        await Promise.all(cachePromises);
        console.log('✓ Cleared all Cache API caches');
      }
    } catch (error) {
      console.warn('Error clearing Cache API:', error);
    }
    
    
    // 3. Clear localStorage items related to Transformers.js
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const lower = key.toLowerCase();
          if (lower.includes('transformers') ||
              lower.includes('xenova') ||
              lower.includes('hf-') ||
              lower.includes('huggingface')) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(key => {
        console.log(`Clearing localStorage: ${key}`);
        localStorage.removeItem(key);
      });
      if (keysToRemove.length > 0) {
        console.log(`✓ Cleared ${keysToRemove.length} localStorage items`);
      }
    } catch (error) {
      console.warn('Error clearing localStorage:', error);
    }
    
    // 4. Clear sessionStorage items related to Transformers.js
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const lower = key.toLowerCase();
          if (lower.includes('transformers') ||
              lower.includes('xenova') ||
              lower.includes('hf-')) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(key => {
        console.log(`Clearing sessionStorage: ${key}`);
        sessionStorage.removeItem(key);
      });
      if (keysToRemove.length > 0) {
        console.log(`✓ Cleared ${keysToRemove.length} sessionStorage items`);
      }
    } catch (error) {
      console.warn('Error clearing sessionStorage:', error);
    }
    
    // 5. Clear the in-memory model cache
    clipModel = null;
    modelLoadError = null;
    
    console.log('Model cache clearing complete');
  } catch (error) {
    console.warn('Error clearing model cache:', error);
  }
}

/**
 * Initialize CLIP model (lazy loading)
 */
async function getCLIPModel() {
  if (!clipModel && !modelLoadError) {
    try {
      console.log('Loading CLIP model...');
      
      clipModel = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
        quantized: false, // Use full precision model
      });
      
      console.log('✓ CLIP model loaded');
    } catch (error) {
      console.error('Failed to load CLIP model:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      modelLoadError = error instanceof Error ? error : new Error('Unknown error loading CLIP model');
      
      // If it's a JSON parse error, try clearing cache and retry once
      if (error instanceof Error && error.message.includes('JSON.parse')) {
        console.log('JSON parse error detected - clearing cache and retrying...');
        await clearModelCache();
        
        // Give Firefox time to process cache deletions
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Reset error and try once more
        modelLoadError = null;
        try {
          console.log('Retrying CLIP model load after cache clear...');
          clipModel = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
            quantized: false,
          });
          console.log('✓ CLIP model loaded after cache clear');
          return clipModel;
        } catch (retryError) {
          console.error('Retry also failed:', retryError);
          modelLoadError = retryError instanceof Error ? retryError : new Error('Unknown error');
          throw new Error(
            'Unable to load the image analysis model. Please check your internet connection and try again. ' +
            'If the problem persists, try refreshing the page.'
          );
        }
      }
      throw error;
    }
  }
  
  if (modelLoadError) {
    throw modelLoadError;
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

