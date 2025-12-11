# Deploying Schema Changes to Convex

## The Issue

The `compositionProbabilities` field is defined in `convex/schema.ts`, but it won't exist in your database until you **deploy the schema changes** to your Convex deployments.

## How to Deploy Schema Changes

Convex automatically applies schema changes when you deploy functions. The schema is part of your deployment.

### Deploy to Dev

```bash
# Option 1: Deploy once (recommended for schema changes)
npx convex dev --once

# Option 2: Start dev mode (watches for changes)
npx convex dev
```

This will:
- Deploy all Convex functions to your dev deployment
- **Apply schema changes** (adds the `compositionProbabilities` field to the `pictures` table)
- Update your dev database

### Deploy to Production

```bash
npx convex deploy
```

This will:
- Deploy all Convex functions to your production deployment
- **Apply schema changes** (adds the `compositionProbabilities` field to the `pictures` table)
- Update your production database

## Verify Schema Deployment

### In Convex Dashboard

1. Go to https://dashboard.convex.dev
2. Select your deployment (dev or prod)
3. Go to **Data** → **Schema**
4. Check the `pictures` table
5. You should see `compositionProbabilities` listed as an optional field

### Using a Query

You can also verify by checking if the field exists:

```typescript
// In Convex Dashboard → Functions → Run Query
// Or from your frontend
const picture = await convex.query(api.pictures.getPicture, {
  pictureId: somePictureId
});

// Check if field exists (will be undefined if not deployed yet)
console.log('Has compositionProbabilities field:', 'compositionProbabilities' in picture);
```

## Important Notes

1. **Schema changes are additive**: Adding a new optional field is safe and won't break existing records
2. **Existing records**: Old picture records won't have this field until they're classified
3. **No data loss**: Adding an optional field doesn't affect existing data
4. **Deploy both**: Make sure to deploy to both dev AND prod if you're using both

## Quick Checklist

- [ ] Schema updated in `convex/schema.ts` ✓ (already done)
- [ ] Deployed to dev: `npx convex dev --once`
- [ ] Verified in dev dashboard (check Schema tab)
- [ ] Deployed to prod: `npx convex deploy`
- [ ] Verified in prod dashboard (check Schema tab)
- [ ] Tested by uploading an image and checking for `compositionProbabilities`

## After Deployment

Once deployed, the field will be available. When you upload images:
1. The `pictures` record is created (without `compositionProbabilities` initially)
2. Classification runs in the background
3. The `compositionProbabilities` field gets populated with results

You can check if classification completed by querying:
```typescript
const picture = await convex.query(api.pictures.getPicture, { pictureId });
if (picture.compositionProbabilities) {
  // Classification complete!
}
```

