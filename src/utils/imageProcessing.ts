/**
 * Image Processing Utilities for Value Study
 * 
 * This module provides a modular pipeline for image processing operations.
 * The pipeline is designed to be easily reordered and parameterized for experimentation.
 * 
 * Pipeline operations:
 * 1. Blur (smoothness) - Gaussian or Median based on useMedianBlur parameter
 * 2. Posterization (value levels)
 * 3. HSV Value Extraction
 */

export interface ProcessingParameters {
  levels: number // Number of posterization levels (default: 5)
  smoothness: number // Blur radius in pixels (default: calculated from image size)
  useMedianBlur: boolean // Use median blur instead of mean curvature (default: false)
  // Note: Mean curvature blur (default) uses GPU-accelerated Canvas filters and is usually faster
  // Median blur is CPU-bound but may be faster for some users without GPU acceleration
  meanCurvaturePasses: number // Number of mean curvature blur passes (default: 25)
}

export interface ProcessingResult {
  processedImageDataUrl: string // Data URL of processed image
  metadata: {
    width: number
    height: number
    diagonal: number
    originalFormat: string
  }
  parameters: ProcessingParameters
}

/**
 * Calculate appropriate blur radius based on image size
 * Uses ~1/400 of the diagonal, with a minimum of 1px
 * For a 720x416 image (diagonal ~831px): 831/400 ≈ 2px
 * For a 5000px diagonal image: 5000/400 = 12.5px ≈ 12px
 */
export function calculateBlurRadius(width: number, height: number, baseRadius?: number): number {
  const diagonal = Math.sqrt(width * width + height * height)
  // Calculate radius as 1/400th of diagonal
  const calculatedRadius = diagonal / 400
  // Round to nearest integer, minimum 1px
  const radius = Math.max(1, Math.round(calculatedRadius))
  return radius
}

/**
 * Load image from URL and return ImageData
 */
async function loadImageData(imageUrl: string): Promise<{ image: HTMLImageElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      
      ctx.drawImage(image, 0, 0)
      resolve({ image, canvas, ctx })
    }
    
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = imageUrl
  })
}

/**
 * Apply Gaussian blur using Canvas filter (GPU-accelerated in modern browsers)
 */
function applyGaussianBlur(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  radius: number
): void {
  // Canvas filter API is fast and GPU-accelerated
  ctx.filter = `blur(${radius}px)`
  ctx.drawImage(canvas, 0, 0)
  ctx.filter = 'none' // Reset filter
}

/**
 * Apply median blur (manual implementation)
 * This is slower but gives better quality for noise reduction
 */
function applyMedianBlur(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  radius: number
): void {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const width = canvas.width
  const height = canvas.height
  const output = new Uint8ClampedArray(data.length)
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const neighbors: number[][] = []
      
      // Collect neighbors within radius
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = (ny * width + nx) * 4
            neighbors.push([data[nIdx], data[nIdx + 1], data[nIdx + 2]])
          }
        }
      }
      
      // Calculate median for each channel
      for (let c = 0; c < 3; c++) {
        const values = neighbors.map(n => n[c]).sort((a, b) => a - b)
        output[idx + c] = values[Math.floor(values.length / 2)]
      }
      output[idx + 3] = data[idx + 3] // Alpha channel
    }
  }
  
  const outputImageData = new ImageData(output, width, height)
  ctx.putImageData(outputImageData, 0, 0)
}

/**
 * Convert RGB to HSV and extract Value channel
 */
function extractValueChannel(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
): void {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    
    // Calculate Value (brightness) from HSV
    const max = Math.max(r, g, b)
    const value = max
    
    // Convert back to RGB grayscale using the value
    const gray = Math.round(value * 255)
    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
    // Alpha stays the same
  }
  
  ctx.putImageData(imageData, 0, 0)
}

/**
 * Apply posterization (quantize to N levels)
 * Uses uniform step-based quantization: divides 0-255 into equal steps
 */
function applyPosterization(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  levels: number
): void {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  
  // Uniform step-based posterization
  const step = 255 / (levels - 1)
  for (let i = 0; i < data.length; i += 4) {
    // Quantize each RGB channel
    for (let c = 0; c < 3; c++) {
      const value = data[i + c]
      const quantized = Math.round(value / step) * step
      data[i + c] = Math.min(255, Math.max(0, quantized))
    }
  }
  
  ctx.putImageData(imageData, 0, 0)
}


/**
 * Main processing pipeline
 * 
 * This function applies the image processing pipeline in the specified order.
 * The order can be easily modified for experimentation.
 * 
 * Current order (as specified):
 * 1. Gaussian Blur
 * 2. Posterization
 * 3. HSV Value Extraction
 * 4. Median Blur or Mean Curvature Blur
 */
export async function processValueStudy(
  imageUrl: string,
  parameters: Partial<ProcessingParameters> = {}
): Promise<ProcessingResult> {
  const {
    levels = 5,
    smoothness,
    useMedianBlur = false, // Default: false means use mean curvature blur (faster with GPU)
    meanCurvaturePasses = 25
  } = parameters
  
  // Load image
  const { image, canvas, ctx } = await loadImageData(imageUrl)
  const width = image.naturalWidth
  const height = image.naturalHeight
  const diagonal = Math.sqrt(width * width + height * height)
  
  // Calculate blur radius if not provided
  const blurRadius = smoothness ?? calculateBlurRadius(width, height)
  
  // Create a working canvas for intermediate steps
  const workingCanvas = document.createElement('canvas')
  workingCanvas.width = width
  workingCanvas.height = height
  const workingCtx = workingCanvas.getContext('2d')!
  
  // ============================================
  // PROCESSING PIPELINE
  // ============================================
  // This section can be reordered for experimentation
  // Current order: Blur -> Posterization -> Value Extraction
  
  // Step 1: Blur (smoothness) - Gaussian or Median based on useMedianBlur
  workingCtx.drawImage(canvas, 0, 0)
  if (useMedianBlur) {
    // Median Blur - CPU-bound manual pixel processing with sorting
    // May be faster for some users without GPU acceleration
    applyMedianBlur(workingCtx, workingCanvas, blurRadius)
  } else {
    // Gaussian Blur - GPU-accelerated Canvas filter API (usually faster)
    applyGaussianBlur(workingCtx, workingCanvas, blurRadius)
  }
  
  // Step 2: Posterization (quantize to N levels)
  applyPosterization(workingCtx, workingCanvas, levels)
  
  // Step 3: Extract Value channel (HSV)
  extractValueChannel(workingCtx, workingCanvas)
  
  // ============================================
  // END PIPELINE
  // ============================================
  
  // Convert to data URL
  const processedImageDataUrl = workingCanvas.toDataURL('image/png')
  
  return {
    processedImageDataUrl,
    metadata: {
      width,
      height,
      diagonal,
      originalFormat: 'image/png'
    },
    parameters: {
      levels,
      smoothness: blurRadius,
      useMedianBlur: useMedianBlur, // Default: false (uses mean curvature blur)
      meanCurvaturePasses
    }
  }
}

/**
 * Alternative pipeline order for experimentation
 * This version: Median Blur -> Value Extraction -> Posterization
 * (As suggested by user - may be faster)
 */
export async function processValueStudyAlternative(
  imageUrl: string,
  parameters: Partial<ProcessingParameters> = {}
): Promise<ProcessingResult> {
  const {
    levels = 5,
    smoothness,
    useMedianBlur = false, // Default: false means use mean curvature blur (faster with GPU)
    meanCurvaturePasses = 25
  } = parameters
  
  const { image, canvas, ctx } = await loadImageData(imageUrl)
  const width = image.naturalWidth
  const height = image.naturalHeight
  const diagonal = Math.sqrt(width * width + height * height)
  
  const blurRadius = smoothness ?? calculateBlurRadius(width, height)
  
  const workingCanvas = document.createElement('canvas')
  workingCanvas.width = width
  workingCanvas.height = height
  const workingCtx = workingCanvas.getContext('2d')!
  
  // Alternative order: Blur -> Value Extraction -> Posterization
  workingCtx.drawImage(canvas, 0, 0)
  
  // Step 1: Blur first (noise reduction)
  // Default: Mean Curvature Blur (GPU-accelerated, usually faster)
  // Alternative: Median Blur (CPU-bound, may be faster for users without GPU)
  if (useMedianBlur) {
    applyMedianBlur(workingCtx, workingCanvas, blurRadius)
  } else {
    for (let pass = 0; pass < meanCurvaturePasses; pass++) {
      applyGaussianBlur(workingCtx, workingCanvas, blurRadius * 0.3)
    }
  }
  
  // Step 2: Extract Value channel
  extractValueChannel(workingCtx, workingCanvas)
  
  // Step 3: Posterization
  applyPosterization(workingCtx, workingCanvas, levels)
  
  const processedImageDataUrl = workingCanvas.toDataURL('image/png')
  
  return {
    processedImageDataUrl,
    metadata: {
      width,
      height,
      diagonal,
      originalFormat: 'image/png'
    },
    parameters: {
      levels,
      smoothness: blurRadius,
      useMedianBlur: useMedianBlur, // Default: false (uses mean curvature blur)
      meanCurvaturePasses
    }
  }
}


