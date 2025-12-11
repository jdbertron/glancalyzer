import { useEffect, useRef } from 'react';
import {
  ADSTERRA_ENABLED,
  ADSTERRA_SLOTS,
  AD_FORMATS,
  type AdsterraSlotKey,
  type AdFormat,
} from '../../config/ads';

interface AdsterraBannerProps {
  /**
   * The ad slot key from ADSTERRA_SLOTS configuration
   * Use this for pre-configured ad placements
   */
  slot?: AdsterraSlotKey;
  
  /**
   * Override format (optional - defaults to slot's format or 'responsive')
   */
  format?: AdFormat;
  
  /**
   * Custom ad code (for dynamic/non-configured slots)
   * Can be either a script URL or a div ID
   */
  customAdCode?: string;
  
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
 * Adsterra Banner Component
 * 
 * Usage Examples:
 * 
 * // Using pre-configured slot:
 * <AdsterraBanner slot="uploadPageBottom" />
 * 
 * // With custom styling:
 * <AdsterraBanner slot="picturesPageBanner" className="my-4" />
 * 
 * // Override format:
 * <AdsterraBanner slot="uploadPageBottom" format="rectangle" />
 * 
 * // Custom ad code (for dynamic ad units):
 * <AdsterraBanner customAdCode="https://www.adsterra.com/script/XXXXX.js" format="horizontal" />
 * <AdsterraBanner customAdCode="adsterra-XXXXX" format="horizontal" />
 */
export function AdsterraBanner({ 
  slot, 
  format, 
  customAdCode,
  className = '',
  showLabel = true,
}: AdsterraBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  // Get slot configuration
  const slotConfig = slot ? ADSTERRA_SLOTS[slot] : null;
  
  // Determine if this specific ad should be shown
  const slotEnabled = slotConfig?.enabled ?? true;
  const adCode = customAdCode || slotConfig?.adCode;
  const adFormat = format || slotConfig?.format || 'responsive';
  const formatConfig = AD_FORMATS[adFormat];

  // Don't render if ads are disabled globally or for this slot
  if (!ADSTERRA_ENABLED || !slotEnabled || !adCode) {
    // Show placeholder if in development
    if (process.env.NODE_ENV === 'development' && slot) {
      return (
        <div className={`${className}`}>
          {showLabel && (
            <div className="text-xs text-gray-400 text-center mb-1">Advertisement (Adsterra)</div>
          )}
          <div 
            className={`bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500 ${formatConfig.className}`}
            style={{ 
              ...formatConfig.style,
              minHeight: ('minHeight' in formatConfig.style ? formatConfig.style.minHeight : undefined) || '100px',
            }}
          >
            <div className="text-center p-4">
              <div className="text-sm font-medium">Adsterra Ad Placeholder</div>
              <div className="text-xs mt-1">
                {slot ? `Slot: ${slot}` : `Custom: ${adCode}`}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Format: {adFormat}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Add your Adsterra ad code in config/ads.ts
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
    if (!containerRef.current || scriptLoadedRef.current) return;

    const isScriptUrl = adCode.startsWith('http://') || adCode.startsWith('https://');
    const isDivId = adCode.startsWith('adsterra-') || /^[a-zA-Z0-9-_]+$/.test(adCode);

    if (isScriptUrl) {
      // Load script-based ad
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = adCode;
      script.async = true;
      script.onerror = () => {
        console.error('Adsterra script failed to load:', adCode);
      };
      
      containerRef.current.appendChild(script);
      scriptLoadedRef.current = true;
    } else if (isDivId) {
      // For div ID-based ads, Adsterra script should be loaded globally
      // The div will be automatically populated by Adsterra's global script
      // Just ensure the div exists with the correct ID
      if (containerRef.current) {
        const adDiv = document.createElement('div');
        adDiv.id = adCode;
        containerRef.current.appendChild(adDiv);
        scriptLoadedRef.current = true;
      }
    } else {
      console.warn('Adsterra ad code format not recognized. Expected script URL or div ID:', adCode);
    }
  }, [adCode]);

  return (
    <div className={`ad-container adsterra-container ${className}`}>
      {showLabel && (
        <div className="text-xs text-gray-400 text-center mb-1">Advertisement</div>
      )}
      <div
        ref={containerRef}
        className={`adsterra-ad ${formatConfig.className}`}
        style={formatConfig.style}
      />
    </div>
  );
}

