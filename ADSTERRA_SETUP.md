# Adsterra Ad Integration Setup

This document explains how the Adsterra ad integration is set up in this project.

## Overview

The project uses **Adsterra** for monetization. Google AdSense code is preserved but commented out for future use if approval is obtained.

## Architecture

### Components

- **`src/config/ads.ts`** - Central configuration file for all ad settings
- **`src/components/ads/AdsterraBanner.tsx`** - React component that renders Adsterra ads
- **`src/components/ads/AdBanner.tsx`** - AdSense component (commented out, preserved for future)
- **`src/components/ads/index.ts`** - Exports for easy importing

### Pages Using Ads

- **Upload Page** (`src/pages/Upload.tsx`) - Bottom banner ad
- **My Pictures Page** (`src/pages/MyPictures.tsx`) - Top banner + in-feed ads
- **Tips Page** (`src/pages/EyeTrackingTips.tsx`) - Sidebar ad

## Ad Placements

### 1. `uploadPageBottom`
- **Format**: Banner
- **Size**: 728×90 (Leaderboard)
- **Location**: Bottom of upload form
- **Ad Code**: Reuses `picturesPageBanner` code

### 2. `uploadPageSidebar`
- **Format**: Banner
- **Size**: 160×600 (Wide Skyscraper)
- **Location**: Sidebar (if added)
- **Ad Code**: Reuses `tipsSidebar` code

### 3. `picturesPageInFeed`
- **Format**: Native Banner (recommended) or Banner
- **Size**: 300×250 (Medium Rectangle)
- **Location**: Between picture cards (every 8th picture)
- **Ad Code**: `https://www.highperformanceformat.com/d6fbd63c8b82c85ba1546c2f43d17d1d/invoke.js`

### 4. `picturesPageBanner`
- **Format**: Banner
- **Size**: 728×90 (Leaderboard)
- **Location**: Top of My Pictures page
- **Ad Code**: `https://www.highperformanceformat.com/c62fe62595e072eb7d693c385704b105/invoke.js`

### 5. `tipsSidebar`
- **Format**: Banner
- **Size**: 160×600 (Wide Skyscraper)
- **Location**: Sidebar below categories
- **Ad Code**: `https://www.highperformanceformat.com/e3dd60af77eb8c0958738333f8966aa5/invoke.js`

## Configuration

### Main Settings (`src/config/ads.ts`)

```typescript
// Enable/disable all Adsterra ads
export const ADSTERRA_ENABLED = true;

// Test mode (automatically enabled in development)
export const ADSTERRA_TEST_MODE = // auto-detects localhost/development
```

### Test Mode

The integration automatically detects local development and shows placeholders instead of real ads:

- **Localhost** (`localhost`, `127.0.0.1`)
- **Local IPs** (`192.168.x.x`, `10.x.x.x`)
- **Development mode** (`NODE_ENV === 'development'`)

In test mode:
- ✅ Placeholder boxes are shown
- ✅ No real ad scripts are loaded
- ✅ No impressions/clicks are generated
- ✅ Ad slot information is displayed for debugging

In production:
- ✅ Real ads load automatically
- ✅ All ad placements are active

## How It Works

### Adsterra Ad Code Format

Adsterra provides ad codes in this format:

```html
<script type="text/javascript">
  atOptions = {
    'key' : 'd6fbd63c8b82c85ba1546c2f43d17d1d',
    'format' : 'iframe',
    'height' : 250,
    'width' : 300,
    'params' : {}
  };
</script>
<script
  type="text/javascript"
  src="https://www.highperformanceformat.com/d6fbd63c8b82c85ba1546c2f43d17d1d/invoke.js"
></script>
```

### Component Implementation

The `AdsterraBanner` component:

1. **Extracts the ad key** from the script URL
2. **Sets up `atOptions`** with correct dimensions based on format
3. **Loads the script** dynamically
4. **Creates unique containers** for each ad instance

### Usage in Pages

```tsx
import { AdsterraBanner } from '../components/ads'

// Using pre-configured slot
<AdsterraBanner slot="picturesPageBanner" />

// With custom styling
<AdsterraBanner slot="uploadPageBottom" className="my-4" />
```

## Adding New Ad Units

1. **Create the ad unit in Adsterra Dashboard**:
   - Go to: Websites → Your Site → Ad Units
   - Choose format type (Banner, Native Banner, etc.)
   - Select size
   - Click "Get Code"

2. **Extract the script URL**:
   - From the `<script src="...">` tag
   - Copy just the URL (e.g., `https://www.highperformanceformat.com/KEY/invoke.js`)

3. **Add to config** (`src/config/ads.ts`):
   ```typescript
   newAdSlot: {
     adCode: 'https://www.highperformanceformat.com/YOUR_KEY/invoke.js',
     format: 'horizontal' as const, // or 'vertical', 'rectangle'
     enabled: true,
   },
   ```

4. **Use in your component**:
   ```tsx
   <AdsterraBanner slot="newAdSlot" />
   ```

## AdSense (Preserved for Future)

AdSense integration is commented out but preserved in:
- `index.html` - AdSense script (commented)
- `src/config/ads.ts` - AdSense configuration (commented)
- `src/components/ads/AdBanner.tsx` - AdSense component (commented)

To re-enable AdSense:
1. Uncomment the code in `index.html`
2. Set `ADSENSE_ENABLED = true` in `src/config/ads.ts`
3. Uncomment the AdBanner component code
4. Update pages to use `AdBanner` instead of `AdsterraBanner`

## Troubleshooting

### Ads Not Showing

1. **Check test mode**: Verify you're not in development (ads show placeholders locally)
2. **Check configuration**: Ensure `ADSTERRA_ENABLED = true` and slot `enabled = true`
3. **Check browser console**: Look for script loading errors
4. **Verify ad codes**: Ensure script URLs are correct in `src/config/ads.ts`

### Multiple Ads with Same Code

The component handles this by:
- Creating unique containers for each ad instance
- Setting `atOptions` right before each script loads
- Each script executes in its own context

### Ad Format Issues

- Verify the format in config matches the actual ad size
- Check that dimensions are correct (728×90 for horizontal, 160×600 for vertical, etc.)

## File Structure

```
src/
├── config/
│   └── ads.ts                    # Ad configuration (Adsterra + AdSense)
├── components/
│   └── ads/
│       ├── AdsterraBanner.tsx    # Adsterra component (active)
│       ├── AdBanner.tsx          # AdSense component (commented)
│       └── index.ts              # Exports
└── pages/
    ├── Upload.tsx                # Uses AdsterraBanner
    ├── MyPictures.tsx            # Uses AdsterraBanner
    └── EyeTrackingTips.tsx       # Uses AdsterraBanner
```

## Resources

- [Adsterra Publisher Dashboard](https://beta.publishers.adsterra.com/websites)
- [Adsterra Documentation](https://adsterra.com/blog/set-up-publishers-dashboard/)

## Notes

- Adsterra doesn't have a built-in test mode, so we implemented our own
- Test mode prevents generating impressions during local development
- All ad codes are stored in `src/config/ads.ts` for easy management
- The component automatically handles the `atOptions` configuration

