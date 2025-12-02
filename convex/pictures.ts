import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Generate upload URL for file storage
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Upload a picture
export const uploadPicture = mutation({
  args: {
    fileName: v.string(),
    fileId: v.id("_storage"),
    fileHash: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    userId: v.optional(v.id("users")),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({
    pictureId: v.id("pictures"),
    isDuplicate: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for duplicate file hash (only if hash is provided)
    let existingPicture = null;
    if (args.fileHash) {
      existingPicture = await ctx.db
        .query("pictures")
        .withIndex("by_file_hash", (q) => q.eq("fileHash", args.fileHash))
        .first();

      if (existingPicture) {
        return {
          pictureId: existingPicture._id,
          isDuplicate: true,
          message: "This image has already been uploaded. Using existing image.",
        };
      }
    }

    // Check IP rate limiting (1 minute cooldown)
    if (args.ipAddress) {
      const rateLimit = await ctx.db
        .query("rateLimits")
        .withIndex("by_ip", (q) => q.eq("ipAddress", args.ipAddress!))
        .first();

      if (rateLimit && rateLimit.cooldownUntil > now) {
        const remainingTime = Math.ceil((rateLimit.cooldownUntil - now) / 1000);
        throw new Error(`Please wait ${remainingTime} seconds before uploading another image.`);
      }

      // Update or create rate limit record
      const cooldownUntil = now + 60 * 1000; // 1 minute cooldown
      if (rateLimit) {
        await ctx.db.patch(rateLimit._id, {
          lastUploadAt: now,
          uploadCount: rateLimit.uploadCount + 1,
          cooldownUntil,
        });
      } else {
        await ctx.db.insert("rateLimits", {
          ipAddress: args.ipAddress,
          lastUploadAt: now,
          uploadCount: 1,
          windowStart: now,
          cooldownUntil,
        });
      }
    }

    // Calculate expiration based on user status
    let expiresAt: number | undefined = undefined;
    
    if (!args.userId) {
      // Unregistered users: 1 day retention
      expiresAt = now + 24 * 60 * 60 * 1000; // 1 day
    } else {
      // Check user's membership tier
      const user = await ctx.db.get(args.userId);
      if (user) {
        if (user.membershipTier === "free") {
          // Free tier: 7 days retention
          expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days
        }
        // Premium and Professional users: no expiration (unlimited retention)
      }
    }

    const pictureId = await ctx.db.insert("pictures", {
      userId: args.userId,
      fileName: args.fileName,
      fileId: args.fileId,
      fileHash: args.fileHash,
      fileSize: args.fileSize,
      uploadedAt: now,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      expiresAt: expiresAt,
      isExpired: false,
    });

    return {
      pictureId,
      isDuplicate: false,
      message: "Image uploaded successfully!",
    };
  },
});

// Get user's pictures
export const getUserPictures = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  returns: v.array(
    v.object({
      _id: v.id("pictures"),
      fileName: v.string(),
      fileId: v.id("_storage"),
      uploadedAt: v.float64(),
      fileSize: v.optional(v.float64()),
      experimentCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    if (!args.userId) {
      return [];
    }

    const pictures = await ctx.db
      .query("pictures")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isExpired"), false))
      .order("desc")
      .collect();

    // Get experiment count for each picture
    // Explicitly construct return objects to match validator (exclude _creationTime and other extra fields)
    const picturesWithCounts = await Promise.all(
      pictures.map(async (picture) => {
        const experiments = await ctx.db
          .query("experiments")
          .withIndex("by_picture", (q) => q.eq("pictureId", picture._id))
          .collect();

        return {
          _id: picture._id,
          fileName: picture.fileName,
          fileId: picture.fileId,
          uploadedAt: picture.uploadedAt,
          fileSize: picture.fileSize,
          experimentCount: experiments.length,
        };
      })
    );

    return picturesWithCounts;
  },
});

// Get pictures associated with user's experiments (even if userId doesn't match)
export const getPicturesFromExperiments = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      _id: v.id("pictures"),
      fileName: v.string(),
      fileId: v.id("_storage"),
      uploadedAt: v.float64(),
      fileSize: v.optional(v.float64()),
      experimentCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Get all experiments for this user
    const experiments = await ctx.db
      .query("experiments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Get unique picture IDs from experiments
    const pictureIds = Array.from(new Set(experiments.map(exp => exp.pictureId)));

    // Fetch all pictures
    const pictures = await Promise.all(
      pictureIds.map(async (pictureId) => {
        const picture = await ctx.db.get(pictureId);
        if (!picture || picture.isExpired === true) return null;
        
        // Count experiments for this picture
        const pictureExperiments = experiments.filter(exp => exp.pictureId === pictureId);
        
        return {
          _id: picture._id,
          fileName: picture.fileName,
          fileId: picture.fileId,
          uploadedAt: picture.uploadedAt,
          fileSize: picture.fileSize,
          experimentCount: pictureExperiments.length,
        };
      })
    );

    // Filter out nulls and sort by uploadedAt descending
    return pictures
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => b.uploadedAt - a.uploadedAt);
  },
});

// Get picture details
export const getPicture = query({
  args: {
    pictureId: v.id("pictures"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const picture = await ctx.db.get(args.pictureId);
    return picture;
  },
});

// Get image URL from storage
export const getImageUrl = query({
  args: {
    fileId: v.id("_storage"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.fileId);
  },
});

// Delete a picture
export const deletePicture = mutation({
  args: {
    pictureId: v.id("pictures"),
    userId: v.optional(v.id("users")),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const picture = await ctx.db.get(args.pictureId);
    
    if (!picture) {
      return {
        success: false,
        message: "Picture not found",
      };
    }

    // Check ownership
    if (picture.userId !== args.userId) {
      return {
        success: false,
        message: "Not authorized to delete this picture",
      };
    }

    // Delete associated experiments first
    // NOTE: We intentionally DO NOT decrement user.experimentCount here.
    // This prevents users from bypassing experiment caps by deleting images.
    // The experimentCount represents lifetime usage, not current experiment count.
    const experiments = await ctx.db
      .query("experiments")
      .withIndex("by_picture", (q) => q.eq("pictureId", args.pictureId))
      .collect();

    for (const experiment of experiments) {
      await ctx.db.delete(experiment._id);
    }

    // Delete the picture
    await ctx.db.delete(args.pictureId);

    return {
      success: true,
      message: "Picture deleted successfully",
    };
  },
});

// Mark expired pictures
// Get upload statistics (for admin/debugging)
export const getUploadStats = query({
  args: {},
  returns: v.object({
    totalPictures: v.number(),
    uniqueIPs: v.number(),
    recentUploads: v.array(v.object({
      fileName: v.string(),
      ipAddress: v.optional(v.string()),
      uploadedAt: v.number(),
    })),
  }),
  handler: async (ctx) => {
    const pictures = await ctx.db.query("pictures").collect();
    const uniqueIPs = new Set(pictures.map(p => p.ipAddress).filter(Boolean));
    
    const recentUploads = pictures
      .sort((a, b) => b.uploadedAt - a.uploadedAt)
      .slice(0, 10)
      .map(p => ({
        fileName: p.fileName,
        ipAddress: p.ipAddress,
        uploadedAt: p.uploadedAt,
      }));

    return {
      totalPictures: pictures.length,
      uniqueIPs: uniqueIPs.size,
      recentUploads,
    };
  },
});

// Internal mutation to clean up expired pictures
// Called by the cron job in crons.ts
// 
// IMPORTANT: When experiments are deleted (either via picture deletion or expiration),
// we intentionally DO NOT decrement the user's experimentCount. This prevents users
// from bypassing experiment caps by deleting images. The experimentCount represents
// a lifetime usage count, not the current number of experiments in the database.
export const cleanupExpiredPictures = internalMutation({
  args: {},
  returns: v.object({
    deletedPictureCount: v.number(),
    deletedAnonymousLimitCount: v.number(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    
    // Find all pictures that have expired
    const allPictures = await ctx.db.query("pictures").collect();
    const expiredPictures = allPictures.filter(
      (p) => p.expiresAt && p.expiresAt < now && !p.isExpired
    );

    let deletedPictureCount = 0;

    for (const picture of expiredPictures) {
      // Delete associated experiments first
      // NOTE: We do NOT decrement user.experimentCount here - this is intentional
      // to prevent cap bypass. See comment above.
      const experiments = await ctx.db
        .query("experiments")
        .withIndex("by_picture", (q) => q.eq("pictureId", picture._id))
        .collect();

      for (const experiment of experiments) {
        await ctx.db.delete(experiment._id);
      }

      // Delete the file from storage
      try {
        await ctx.storage.delete(picture.fileId);
      } catch (e) {
        // File might already be deleted, continue
        console.log(`Could not delete file ${picture.fileId}:`, e);
      }

      // Delete the picture record
      await ctx.db.delete(picture._id);
      deletedPictureCount++;
    }

    // Clean up stale anonymous experiment limit records
    // Records not used in 60 days can be safely deleted (they would have full allotment anyway)
    const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
    const staleThreshold = now - SIXTY_DAYS_MS;
    
    const allAnonymousLimits = await ctx.db.query("anonymousExperimentLimits").collect();
    const staleLimits = allAnonymousLimits.filter(
      (record) => !record.lastExperimentAt || record.lastExperimentAt < staleThreshold
    );

    let deletedAnonymousLimitCount = 0;
    for (const record of staleLimits) {
      await ctx.db.delete(record._id);
      deletedAnonymousLimitCount++;
    }

    return {
      deletedPictureCount,
      deletedAnonymousLimitCount,
      message: `Cleaned up ${deletedPictureCount} expired pictures and ${deletedAnonymousLimitCount} stale anonymous limit records`,
    };
  },
});
