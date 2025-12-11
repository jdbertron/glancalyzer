// AdSense Banner Component - Commented out but kept for future use
// Currently using AdsterraBanner instead

import { useEffect, useRef } from 'react';
import {
  ADSENSE_ENABLED,
  ADSENSE_PUBLISHER_ID,
  ADSENSE_TEST_MODE,
  AD_SLOTS,
  AD_FORMATS,
  type AdSlotKey,
  type AdFormat,
} from '../../config/ads';

// Extend window type for AdSense
declare global {
  interface Window {
    adsbygoogle: Array<Record<string, unknown>>;
  }
}

interface AdBannerProps {
  /**
   * The ad slot key from AD_SLOTS configuration
   * Use this for pre-configured ad placements
   */
  slot?: AdSlotKey;
  
  /**
   * Override format (optional - defaults to slot's format or 'responsive')
   */
  format?: AdFormat;
  
  /**
   * Custom slot ID (for dynamic/non-configured slots)
   */
  customSlotId?: string;
  
  /**
   * Additional CSS classes for the container
   */
  className?: string;
  
  /**
   * Show a subtle label indicating this is an ad
   * Recommended for transparency
   */
  showLabel?: boolean;
}

/**
 * Google AdSense Banner Component
 * 
 * NOTE: This component is currently disabled (AdSense not approved).
 * Using AdsterraBanner instead. This code is kept for future use.
 * 
 * Usage Examples:
 * 
 * // Using pre-configured slot:
 * <AdBanner slot="uploadPageBottom" />
 * 
 * // With custom styling:
 * <AdBanner slot="picturesPageBanner" className="my-4" />
 * 
 * // Override format:
 * <AdBanner slot="uploadPageBottom" format="rectangle" />
 * 
 * // Custom slot (for dynamic ad units):
 * <AdBanner customSlotId="9876543210" format="horizontal" />
 */
export function AdBanner({ 
  slot, 
  format, 
  customSlotId,
  className = '',
  showLabel = true,
}: AdBannerProps) {
  // AdSense is currently disabled - return null
  // Uncomment below when AdSense is approved
  /*
  const adRef = useRef<HTMLModElement>(null);
  const isLoaded = useRef(false);

  // Get slot configuration
  const slotConfig = slot ? AD_SLOTS[slot] : null;
  
  // Determine if this specific ad should be shown
  const slotEnabled = slotConfig?.enabled ?? true;
  const slotId = customSlotId || slotConfig?.slotId;
  const adFormat = format || slotConfig?.format || 'responsive';
  const formatConfig = AD_FORMATS[adFormat];

  // Don't render if ads are disabled globally or for this slot
  if (!ADSENSE_ENABLED || !slotEnabled || !slotId) {
    // In test mode, show a placeholder
    if (ADSENSE_TEST_MODE && slotId) {
      return (
        <div className={`${className}`}>
          {showLabel && (
            <div className="text-xs text-gray-400 text-center mb-1">Advertisement</div>
          )}
          <div 
            className={`bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500 ${formatConfig.className}`}
            style={{ 
              ...formatConfig.style,
              minHeight: ('minHeight' in formatConfig.style ? formatConfig.style.minHeight : undefined) || '100px',
            }}
          >
            <div className="text-center p-4">
              <div className="text-sm font-medium">Ad Placeholder</div>
              <div className="text-xs mt-1">
                {slot ? `Slot: ${slot}` : `Custom: ${slotId}`}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Format: {adFormat}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  // Load the ad when component mounts
  useEffect(() => {
    // Prevent double-loading
    if (isLoaded.current) return;
    
    // Check if adsbygoogle is available
    if (typeof window !== 'undefined' && window.adsbygoogle) {
      try {
        // Push the ad to load
        window.adsbygoogle.push({});
        isLoaded.current = true;
      } catch (error) {
        console.error('AdSense error:', error);
      }
    }
  }, []);

  return (
    <div className={`ad-container ${className}`}>
      {showLabel && (
        <div className="text-xs text-gray-400 text-center mb-1">Advertisement</div>
      )}
      <ins
        ref={adRef}
        className={`adsbygoogle ${formatConfig.className}`}
        style={formatConfig.style}
        data-ad-client={ADSENSE_PUBLISHER_ID}
        data-ad-slot={slotId}
        data-ad-format={formatConfig.dataAdFormat}
        data-full-width-responsive={formatConfig.responsive ? 'true' : 'false'}
      />
    </div>
  );
  */
  
  // Currently disabled - return null
  return null;
}

/**
 * Wrapper component that only renders children on ad-enabled pages
 * Useful for conditional ad sections
 */
interface AdSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function AdSection({ children, className = '' }: AdSectionProps) {
  // AdSense is currently disabled - return null
  // Uncomment below when AdSense is approved
  /*
  if (!ADSENSE_ENABLED && !ADSENSE_TEST_MODE) {
    return null;
  }
  
  return (
    <div className={`ad-section ${className}`}>
      {children}
    </div>
  );
  */
  
  // Currently disabled - return null
  return null;
}


