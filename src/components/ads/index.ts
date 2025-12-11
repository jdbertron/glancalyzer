/**
 * Ad Components - Easy import from a single location
 * 
 * Usage:
 * import { AdsterraBanner, AdBanner, AdSection } from '../components/ads';
 * 
 * NOTE: Currently using AdsterraBanner (AdSense is disabled)
 */

// Adsterra (currently active)
export { AdsterraBanner } from './AdsterraBanner';

// AdSense (commented out - kept for future use)
export { AdBanner, AdSection } from './AdBanner';

// Re-export configuration for convenience
export { 
  ADSTERRA_ENABLED,
  ADSTERRA_SLOTS,
  ADSENSE_ENABLED, 
  ADSENSE_TEST_MODE,
  PAGE_ADS_ENABLED,
  AD_SLOTS,
} from '../../config/ads';


