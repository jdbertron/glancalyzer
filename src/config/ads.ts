/**
 * Google AdSense Configuration
 * 
 * HOW TO SET UP:
 * 1. Sign up at https://adsense.google.com
 * 2. Get your Publisher ID (ca-pub-XXXXXXXXXXXXXXXX)
 * 3. Create ad units in the AdSense dashboard for each placement
 * 4. Copy the slot IDs here
 * 5. Set ADSENSE_ENABLED to true when ready
 * 
 * Ad unit types recommended:
 * - Display ads (responsive) - good for most placements
 * - In-feed ads - good for between picture cards
 * - Horizontal banner - good for page headers/footers
 */

// ============================================================================
// MAIN CONFIGURATION - Edit these values
// ============================================================================

/**
 * Master switch - set to true when AdSense is approved and ready
 * Keep false during development to avoid policy violations
 */
export const ADSENSE_ENABLED = false;

/**
 * Your Google AdSense Publisher ID
 * Get this from your AdSense dashboard
 */
export const ADSENSE_PUBLISHER_ID = 'ca-pub-1598809432303523';

/**
 * Test mode - shows placeholder boxes instead of real ads
 * Useful for development and testing layouts
 */
export const ADSENSE_TEST_MODE = true;

// ============================================================================
// AD SLOTS CONFIGURATION
// ============================================================================

/**
 * Ad slot configurations for different placements
 * Create these ad units in your AdSense dashboard and paste the slot IDs here
 */
export const AD_SLOTS = {
  // Upload page - bottom of the upload form
  uploadPageBottom: {
    slotId: '1234567890', // Replace with your actual slot ID
    format: 'horizontal' as const,
    enabled: true,
  },
  
  // Upload page - sidebar (if you add a sidebar layout)
  uploadPageSidebar: {
    slotId: '1234567891',
    format: 'vertical' as const,
    enabled: true,
  },
  
  // My Pictures page - between picture cards (in-feed style)
  picturesPageInFeed: {
    slotId: '1234567892',
    format: 'rectangle' as const,
    enabled: true,
  },
  
  // My Pictures page - top banner
  picturesPageBanner: {
    slotId: '1234567893',
    format: 'horizontal' as const,
    enabled: true,
  },
  
  // Tips page - sidebar below categories
  tipsSidebar: {
    slotId: '1234567894',
    format: 'vertical' as const,
    enabled: true,
  },
} as const;

// ============================================================================
// PAGE-LEVEL AD SETTINGS
// ============================================================================

/**
 * Control which pages show ads
 * Set to false to disable ads on specific pages
 */
export const PAGE_ADS_ENABLED = {
  // Pages WITH ads
  home: false,           // Landing page - usually ad-free for better first impression
  upload: true,          // Upload page - good for ads
  myPictures: true,      // Pictures gallery - good for ads
  tips: true,            // Tips page - sidebar ad
  
  // Pages WITHOUT ads (as per user request)
  calibration: false,    // No distractions during calibration
  eyeTracking: false,    // No distractions during tracking
  results: false,        // Clean results display
  
  // Auth pages - typically no ads
  login: false,
  register: false,
  profile: false,
} as const;

// ============================================================================
// AD FORMAT PRESETS
// ============================================================================

/**
 * Standard ad sizes/formats
 * These correspond to common AdSense responsive ad formats
 */
export const AD_FORMATS = {
  horizontal: {
    style: { display: 'block', width: '100%', height: 'auto', minHeight: '90px' },
    className: 'w-full',
    dataAdFormat: 'horizontal',
    responsive: true,
  },
  vertical: {
    style: { display: 'block', width: '160px', height: '600px' },
    className: 'mx-auto',
    dataAdFormat: 'vertical',
    responsive: false,
  },
  rectangle: {
    style: { display: 'block', width: '100%', maxWidth: '336px', height: 'auto', minHeight: '280px' },
    className: 'mx-auto',
    dataAdFormat: 'rectangle',
    responsive: true,
  },
  responsive: {
    style: { display: 'block', width: '100%', height: 'auto' },
    className: 'w-full',
    dataAdFormat: 'auto',
    responsive: true,
  },
} as const;

export type AdFormat = keyof typeof AD_FORMATS;
export type AdSlotKey = keyof typeof AD_SLOTS;


