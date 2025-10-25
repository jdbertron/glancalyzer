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
        .withIndex("by_ip", (q) => q.eq("ipAddress", args.ipAddress))
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

    const pictureId = await ctx.db.insert("pictures", {
      userId: args.userId,
      fileName: args.fileName,
      fileId: args.fileId,
      fileHash: args.fileHash,
      fileSize: args.fileSize,
      uploadedAt: now,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
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
      uploadedAt: v.number(),
      fileSize: v.optional(v.number()),
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
    const picturesWithCounts = await Promise.all(
      pictures.map(async (picture) => {
        const experiments = await ctx.db
          .query("experiments")
          .withIndex("by_picture", (q) => q.eq("pictureId", picture._id))
          .collect();

        return {
          ...picture,
          experimentCount: experiments.length,
        };
      })
    );

    return picturesWithCounts;
  },
});

// Get picture details
export const getPicture = query({
  args: {
    pictureId: v.id("pictures"),
  },
  returns: v.union(
    v.object({
      _id: v.id("pictures"),
      userId: v.optional(v.id("users")),
      fileName: v.string(),
      fileId: v.id("_storage"),
      uploadedAt: v.number(),
      fileHash: v.optional(v.string()),
      fileSize: v.optional(v.number()),
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
      // Legacy fields for existing records
      expiresAt: v.optional(v.number()),
      isExpired: v.optional(v.boolean()),
    }),
    v.null()
  ),
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
  returns: v.string(),
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

// Note: Removed markExpiredPictures and cleanupExpiredPictures functions
// Pictures are now kept indefinitely for training data collection
