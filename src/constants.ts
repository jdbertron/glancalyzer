/**
 * Global application constants
 */

// Eye Tracking Experiment Settings
export const EYE_TRACKING_EXPERIMENT = {
  // Duration of the eye tracking session in seconds
  DURATION_SECONDS: 15,
  
  // Maximum number of gaze points to store in memory
  MAX_GAZE_POINTS: 10000,
  
  // Fixation detection parameters
  FIXATION_THRESHOLD_PX: 50,
  FIXATION_DURATION_MS: 100,
} as const

// Application Settings
export const APP_CONFIG = {
  // Maximum file size for uploads (in bytes)
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  
  // Supported image formats
  SUPPORTED_IMAGE_FORMATS: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  
  // Default pagination size
  DEFAULT_PAGE_SIZE: 20,
} as const
