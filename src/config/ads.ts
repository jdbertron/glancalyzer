/**
 * Ad Configuration - Adsterra & AdSense
 * 
 * ============================================================================
 * ADSTERRA SETUP (Currently Active):
 * ============================================================================
 * 1. Sign up at https://beta.publishers.adsterra.com/websites
 * 2. Add your website to your Adsterra account
 * 3. Create ad units in the Adsterra dashboard for each placement
 * 4. Copy the ad codes (script URLs or div IDs) here
 * 5. Set ADSTERRA_ENABLED to true when ready
 * 
 * ============================================================================
 * ADSENSE SETUP (Commented out - kept for future use):
 * ============================================================================
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
// ADSTERRA CONFIGURATION - Currently Active
// ============================================================================

/**
 * Master switch for Adsterra - set to true when ad codes are configured
 */
export const ADSTERRA_ENABLED = true;  // ← Set to `true` after adding ad codes

/**
 * Test mode - shows placeholder boxes instead of real ads
 * Set to true during local development to avoid generating impressions/clicks
 * Set to false in production to show real ads
 * 
 * Note: Adsterra doesn't have a built-in test mode, so we disable ads
 * in development by default to avoid generating test impressions
 * 
 * This automatically detects localhost/development and disables real ads
 */
export const ADSTERRA_TEST_MODE = 
  typeof window !== 'undefined' && (
    process.env.NODE_ENV === 'development' || 
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.')
  );

/**
 * Adsterra ad unit configurations
 * Get these from: Adsterra Dashboard → Websites → Your Site → Ad Units → Get Code
 * 
 * ============================================================================
 * REQUIRED AD UNITS TO CREATE IN ADSTERRA:
 * ============================================================================
 * 
 * Adsterra Format Types Available:
 * - Banner: Traditional display ads (recommended for most placements)
 * - Native Banner: Blends with content (best for in-feed placements)
 * - Popunder: Opens behind main window (not recommended for inline)
 * - SmartLink: Redirect URL (not for inline display)
 * - Social Bar: Floating interactive elements (not for inline display)
 * 
 * ============================================================================
 * AD UNIT SPECIFICATIONS:
 * ============================================================================
 * 
 * 1. uploadPageBottom
 *    → Format Type: Banner
 *    → Size: 728×90 (Leaderboard) or Responsive
 *    → Placement: Bottom of upload form
 * 
 * 2. uploadPageSidebar
 *    → Format Type: Banner
 *    → Size: 160×600 (Wide Skyscraper)
 *    → Placement: Sidebar (if you add one)
 * 
 * 3. picturesPageInFeed
 *    → Format Type: Native Banner (recommended) or Banner
 *    → Size: 300×250 (Medium Rectangle)
 *    → Placement: Between picture cards (blends with content)
 * 
 * 4. picturesPageBanner
 *    → Format Type: Banner
 *    → Size: 728×90 (Leaderboard) or Responsive
 *    → Placement: Top of My Pictures page
 * 
 * 5. tipsSidebar
 *    → Format Type: Banner
 *    → Size: 160×600 (Wide Skyscraper)
 *    → Placement: Sidebar below categories
 * 
 * ============================================================================
 * GETTING AD CODES:
 * ============================================================================
 * After creating each ad unit in Adsterra Dashboard:
 * 1. Go to: Websites → Your Site → Ad Units
 * 2. Click "Get Code" for each ad unit
 * 3. Copy the script URL or div ID
 * 4. Paste it into the adCode field below
 * 
 * You'll get either:
 * - A script tag: <script src="https://www.adsterra.com/script/XXXXX.js"></script>
 * - A div with ID: <div id="adsterra-XXXXX"></div>
 * 
 * Store just the URL or ID in the adCode field (not the full HTML tag).
 */
export const ADSTERRA_SLOTS = {
  // Upload page - bottom of the upload form
  // Adsterra Format: Banner | Size: 728×90 (Leaderboard) or Responsive
  uploadPageBottom: {
    // Reusing same code as picturesPageBanner (728×90)
    adCode: 'https://www.highperformanceformat.com/c62fe62595e072eb7d693c385704b105/invoke.js',
    format: 'horizontal' as const,
    enabled: true,
  },
  
  // Upload page - sidebar (if you add a sidebar layout)
  // Adsterra Format: Banner | Size: 160×600 (Wide Skyscraper)
  uploadPageSidebar: {
    // Reusing same code as tipsSidebar (160×600)
    adCode: 'https://www.highperformanceformat.com/e3dd60af77eb8c0958738333f8966aa5/invoke.js',
    format: 'vertical' as const,
    enabled: true,
  },
  
  // My Pictures page - between picture cards (in-feed style)
  // Adsterra Format: Native Banner (recommended) or Banner | Size: 300×250 (Medium Rectangle)
  picturesPageInFeed: {
    // Script URL from Adsterra (extract from the <script src="..."> tag)
    adCode: 'https://www.highperformanceformat.com/d6fbd63c8b82c85ba1546c2f43d17d1d/invoke.js',
    format: 'rectangle' as const,
    enabled: true,
  },
  
  // My Pictures page - top banner
  // Adsterra Format: Banner | Size: 728×90 (Leaderboard) or Responsive
  picturesPageBanner: {
    adCode: 'https://www.highperformanceformat.com/c62fe62595e072eb7d693c385704b105/invoke.js',
    format: 'horizontal' as const,
    enabled: true,
  },
  
  // Tips page - sidebar below categories
  // Adsterra Format: Banner | Size: 160×600 (Wide Skyscraper)
  tipsSidebar: {
    adCode: 'https://www.highperformanceformat.com/e3dd60af77eb8c0958738333f8966aa5/invoke.js',
    format: 'vertical' as const,
    enabled: true,
  },
} as const;

// ============================================================================
// ADSENSE CONFIGURATION - Commented out (kept for future use)
// ============================================================================

/**
 * Master switch - set to true when AdSense is approved and ready
 * Keep false during development to avoid policy violations
 */
export const ADSENSE_ENABLED = false;  // ← Set to `true` after AdSense approval email

/**
 * Your Google AdSense Publisher ID
 * Get this from your AdSense dashboard
 */
export const ADSENSE_PUBLISHER_ID = 'ca-pub-1598809432303523';

/**
 * Test mode - shows placeholder boxes instead of real ads
 * Useful for development and testing layouts
 */
export const ADSENSE_TEST_MODE = false;  // ← Set to `false` for real ads after approval

// ============================================================================
// AD SLOTS CONFIGURATION
// ============================================================================

/**
 * AdSense ad slot configurations (commented out - kept for future use)
 * Create these ad units in your AdSense dashboard and paste the slot IDs here
 */
export const AD_SLOTS = {
  // Upload page - bottom of the upload form
  // To get slot IDs: AdSense Dashboard → Ads → By ad unit → Create Display ad → Copy slot ID from generated code
  uploadPageBottom: {
    slotId: '4621249789', 
    format: 'horizontal' as const,
    enabled: true,
  },
  
  // Upload page - sidebar (if you add a sidebar layout)
  uploadPageSidebar: {
    slotId: '3722159133',
    format: 'vertical' as const,
    enabled: true,
  },
  
  // My Pictures page - between picture cards (in-feed style)
  picturesPageInFeed: {
    slotId: '4983393624',
    format: 'rectangle' as const,
    enabled: true,
  },
  
  // My Pictures page - top banner
  picturesPageBanner: {
    slotId: '9570324134',
    format: 'horizontal' as const,
    enabled: true,
  },
  
  // Tips page - sidebar below categories
  tipsSidebar: {
    slotId: '5662050472',
    format: 'vertical' as const,
    enabled: true,
  },
} as const;

export type AdsterraSlotKey = keyof typeof ADSTERRA_SLOTS;

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


