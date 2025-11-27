/**
 * Debug Configuration
 * 
 * Controls visibility of debug information throughout the app.
 * By default, debug is OFF in production and ON in development.
 * 
 * TO ENABLE DEBUG IN PRODUCTION:
 * Option 1: Set DEBUG_FORCE_ENABLED = true below, rebuild and deploy
 * Option 2: Deploy with VITE_DEBUG=true environment variable
 */

// Manual override - set to true to force debug info even in production
const DEBUG_FORCE_ENABLED = false;

// Check for environment variable override (useful for production debugging without code changes)
const DEBUG_ENV_OVERRIDE = import.meta.env.VITE_DEBUG === 'true';

// Master switch - automatically off in production unless forced
export const DEBUG_ENABLED = DEBUG_FORCE_ENABLED || DEBUG_ENV_OVERRIDE || import.meta.env.DEV;

/**
 * Granular debug controls
 * All respect the master DEBUG_ENABLED switch unless specifically overridden
 */
export const DEBUG_CONFIG = {
  // Show debug panels in eye tracking experiment page
  showEyeTrackingDebug: DEBUG_ENABLED,
  
  // Show debug panels in calibration lab
  // Note: Lab is specifically for debugging/testing, so this defaults to true
  showCalibrationDebug: true,
  
  // Show experiment debug info on PictureExperiments page
  showExperimentDebug: DEBUG_ENABLED,
  
  // Enable verbose console.log statements
  enableConsoleLogging: DEBUG_ENABLED,
  
  // Show WebGazer video preview and gaze point overlay by default
  showWebGazerOverlay: DEBUG_ENABLED,
} as const;

// Type export for use in components
export type DebugConfigKey = keyof typeof DEBUG_CONFIG;

