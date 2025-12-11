# Image Classification Flow

## When Classification Runs

**Yes, classification runs automatically after upload completes.**

Here's the exact flow:

### 1. User Uploads Image
- User uploads image via frontend (`Upload.tsx`)
- Image is uploaded to Convex Storage
- `uploadPicture` mutation is called

### 2. Upload Mutation Completes
In `convex/pictures.ts`, the `uploadPicture` mutation:
1. Creates a record in the `pictures` table
2. **Immediately schedules classification** using:
   ```typescript
   await ctx.scheduler.runAfter(0, internal.imageClassification.classifyImage, {
     pictureId,
     fileId: args.fileId,
   });
   ```
   - `runAfter(0, ...)` means it runs **immediately after** the mutation completes
   - It runs **asynchronously** (doesn't block the upload response)
   - The user gets a response right away, classification happens in the background

### 3. Classification Runs (Asynchronously)
The `classifyImage` action:
1. Fetches the image from Convex storage
2. Extracts CLIP features using `@xenova/transformers`
3. Loads the ONNX model from Convex storage
4. Runs inference (CLIP features → MLP → probabilities)
5. Stores results in the database

## Where Results Are Stored

**Results are stored in the `pictures` table** in the `compositionProbabilities` field.

### Database Location
- **Table:** `pictures`
- **Field:** `compositionProbabilities`
- **Type:** JSON object (optional field)

### Data Structure
The `compositionProbabilities` field contains a JSON object like:
```json
{
  "steelyard": 0.15,
  "balanced_scales": 0.08,
  "circular": 0.12,
  "compound_curve": 0.05,
  "diagonal": 0.25,
  "cross": 0.10,
  "radiating_line": 0.08,
  "tunnel": 0.05,
  "inverted_steelyard": 0.03,
  "u_shaped": 0.04,
  "triangle": 0.02,
  "no_composition": 0.03
}
```

### How to Access Results

**From Frontend:**
```typescript
// Get a specific picture
const picture = await convex.query(api.pictures.getPicture, {
  pictureId: pictureId
});

// Access composition probabilities
console.log(picture.compositionProbabilities);
// {
//   "steelyard": 0.15,
//   "balanced_scales": 0.08,
//   ...
// }
```

**From Convex Functions:**
```typescript
const picture = await ctx.db.get(pictureId);
const probabilities = picture.compositionProbabilities;
```

**In Convex Dashboard:**
1. Go to **Data** → **pictures** table
2. Find your picture record
3. Look at the `compositionProbabilities` field

## Timing

- **Upload response:** Returns immediately (~100-500ms)
- **Classification:** Runs in background (~2-10 seconds depending on image size and model loading)
- **Results available:** Once classification completes, the `compositionProbabilities` field is populated

## Important Notes

1. **Asynchronous:** Classification doesn't block the upload - users get immediate feedback
2. **Automatic:** No manual trigger needed - happens automatically for every new upload
3. **Idempotent:** If classification fails, you can manually trigger it using `classifyUploadedImage` action
4. **Stored with picture:** Results are part of the picture record, not a separate table

## Checking Classification Status

To check if an image has been classified:

```typescript
const picture = await convex.query(api.pictures.getPicture, {
  pictureId: pictureId
});

if (picture.compositionProbabilities) {
  console.log("Classification complete:", picture.compositionProbabilities);
} else {
  console.log("Classification pending or failed");
}
```

## Manual Re-classification

If you need to re-classify an image (e.g., after updating the model):

```typescript
await convex.action(api.imageClassification.classifyUploadedImage, {
  pictureId: pictureId
});
```

This will:
1. Check if already classified (skips if exists)
2. Run classification again
3. Update the `compositionProbabilities` field

