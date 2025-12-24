import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Custom error class for rate limiting
class RateLimitError extends Error {
  constructor(message: string, public code: string = "RATE_LIMIT_EXCEEDED") {
    super(message);
    this.name = "RateLimitError";
  }
}

// Token bucket configuration for experiment rate limiting
// Each tier has a maximum allotment and a refill rate (experiments per day)
// Tiers must match schema.ts: free, premium, professional
const TIER_CONFIG = {
  free: { maxAllotment: 3, refillPerDay: 3 / 7 },              // 3 max, ~0.43/day (3/week)
  premium: { maxAllotment: 100, refillPerDay: 100 / 30 },      // 100 max, ~3.33/day (100/month)
  professional: { maxAllotment: 500, refillPerDay: 500 / 30 }, // 500 max, ~16.67/day (500/month)
} as const;

// Configuration for unregistered/anonymous users (tracked by IP)
// Limit applies per image, not per experiment - once an image is uploaded and used,
// users can run all experiments on that image without additional limits
const ANONYMOUS_CONFIG = {
  maxAllotment: 5,  // 5 images per month
  refillPerDay: 5 / 30,  // 5 per month ≈ 0.167/day
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calculate the refilled allotment based on time elapsed since last experiment.
 * Uses token bucket algorithm: allotment refills over time up to a maximum.
 */
function calculateRefilledAllotment(
  currentAllotment: number,
  lastExperimentAt: number | undefined,
  tierConfig: { maxAllotment: number; refillPerDay: number }
): number {
  // If no previous experiment, user should have full allotment
  if (!lastExperimentAt) {
    return tierConfig.maxAllotment;
  }

  const now = Date.now();
  const elapsedMs = now - lastExperimentAt;
  const elapsedDays = elapsedMs / MS_PER_DAY;
  
  // Calculate refilled amount
  const refillAmount = elapsedDays * tierConfig.refillPerDay;
  
  // Add refill to current allotment, cap at max
  const newAllotment = Math.min(
    currentAllotment + refillAmount,
    tierConfig.maxAllotment
  );
  
  return newAllotment;
}

/**
 * Get experiment allotment information for a user or anonymous visitor.
 * Used to show friendly status messages and disable buttons when at limit.
 */
export const getExperimentAllotmentInfo = query({
  args: {
    userId: v.optional(v.id("users")),
    ipAddress: v.optional(v.string()),
  },
  returns: v.object({
    canRunExperiment: v.boolean(),
    currentAllotment: v.number(),
    maxAllotment: v.number(),
    hoursUntilNextExperiment: v.optional(v.number()),
    tier: v.string(),
    isRegistered: v.boolean(),
    tierLabel: v.string(),
    refillRate: v.string(),
  }),
  handler: async (ctx, args) => {
    // Check for registered user
    if (args.userId) {
      const user = await ctx.db.get(args.userId);
      if (!user) {
        return {
          canRunExperiment: false,
          currentAllotment: 0,
          maxAllotment: 0,
          hoursUntilNextExperiment: undefined,
          tier: "unknown",
          isRegistered: false,
          tierLabel: "Unknown",
          refillRate: "",
        };
      }

      const tierConfig = TIER_CONFIG[user.membershipTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.free;
      const currentStoredAllotment = user.experimentAllotment ?? tierConfig.maxAllotment;
      const refilledAllotment = calculateRefilledAllotment(
        currentStoredAllotment,
        user.lastExperimentAt,
        tierConfig
      );

      const canRun = refilledAllotment >= 1;
      let hoursUntilNext: number | undefined = undefined;
      if (!canRun) {
        hoursUntilNext = ((1 - refilledAllotment) / tierConfig.refillPerDay) * 24;
      }

      const tierLabels: Record<string, string> = {
        free: "Free",
        premium: "Premium",
        professional: "Professional",
      };

      const refillRates: Record<string, string> = {
        free: "3 studies per week",
        premium: "100 studies per month",
        professional: "500 studies per month",
      };

      return {
        canRunExperiment: canRun,
        currentAllotment: Math.floor(refilledAllotment),
        maxAllotment: tierConfig.maxAllotment,
        hoursUntilNextExperiment: hoursUntilNext,
        tier: user.membershipTier || "free",
        isRegistered: true,
        tierLabel: tierLabels[user.membershipTier || "free"] || "Free",
        refillRate: refillRates[user.membershipTier || "free"] || "3 per week",
      };
    }

    // Check for anonymous user (by IP)
    if (args.ipAddress) {
      const limitRecord = await ctx.db
        .query("anonymousExperimentLimits")
        .withIndex("by_ip", (q) => q.eq("ipAddress", args.ipAddress!))
        .first();

      let refilledAllotment = ANONYMOUS_CONFIG.maxAllotment;
      if (limitRecord) {
        refilledAllotment = calculateRefilledAllotment(
          limitRecord.experimentAllotment,
          limitRecord.lastExperimentAt,
          ANONYMOUS_CONFIG
        );
      }

      const canRun = refilledAllotment >= 1;
      let hoursUntilNext: number | undefined = undefined;
      if (!canRun) {
        const daysUntilNext = (1 - refilledAllotment) / ANONYMOUS_CONFIG.refillPerDay;
        hoursUntilNext = daysUntilNext * 24;
      }

      return {
        canRunExperiment: canRun,
        currentAllotment: Math.floor(refilledAllotment),
        maxAllotment: ANONYMOUS_CONFIG.maxAllotment,
        hoursUntilNextExperiment: hoursUntilNext,
        tier: "anonymous",
        isRegistered: false,
        tierLabel: "Guest",
        refillRate: "5 studies per month",
      };
    }

    // No user ID or IP - assume new anonymous user with full allotment
    return {
      canRunExperiment: true,
      currentAllotment: ANONYMOUS_CONFIG.maxAllotment,
      maxAllotment: ANONYMOUS_CONFIG.maxAllotment,
      hoursUntilNextExperiment: undefined,
        tier: "anonymous",
        isRegistered: false,
        tierLabel: "Guest",
        refillRate: "5 studies per month",
    };
  },
});


// Create a new experiment
export const createExperiment = mutation({
  args: {
    pictureId: v.id("pictures"),
    userId: v.optional(v.id("users")),
    ipAddress: v.optional(v.string()), // For anonymous user rate limiting
    experimentType: v.string(),
    parameters: v.optional(v.any()),
  },
  returns: v.object({
    experimentId: v.id("experiments"),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const callId = Math.random().toString(36).substring(2, 15)
      const timestamp = new Date().toISOString()
      
      console.log(`🔧 [${callId}] createExperiment called at ${timestamp}`)
      console.log(`🔧 [${callId}] Args:`, JSON.stringify({
        pictureId: args.pictureId,
        userId: args.userId,
        ipAddress: args.ipAddress ? '***' : undefined,
        experimentType: args.experimentType,
        parameters: args.parameters
      }))
      
      // Validate required arguments
      if (!args.pictureId) {
        throw new Error("pictureId is required");
      }
      if (!args.experimentType) {
        throw new Error("experimentType is required");
      }
      
      // Check for existing experiments for this picture
      const existingExperiments = await ctx.db
        .query("experiments")
        .withIndex("by_picture", (q) => q.eq("pictureId", args.pictureId))
        .collect();
      
      // Check if picture exists and user has access
      const picture = await ctx.db.get(args.pictureId);
      if (!picture) {
        // console.log(`❌ [${callId}] Picture not found:`, args.pictureId)
        throw new Error("Picture not found");
      }

      if (picture.isExpired) {
        throw new Error("Picture has expired");
      }

      // Check ownership for registered users
      if (args.userId && picture.userId !== args.userId) {
        throw new Error("Not authorized to create experiments on this picture");
      }

      // Check if this picture already has experiments (has been "used")
      // Limit applies per picture, not per experiment - once a picture has been used (has experiments),
      // users can run all experiments on that picture without additional limits
      const existingExperimentsForPicture = await ctx.db
        .query("experiments")
        .withIndex("by_picture", (q) => q.eq("pictureId", args.pictureId))
        .collect();
      
      // Picture is "used" if it already has experiments
      // This means the first experiment already counted toward the limit
      const pictureHasBeenUsed = existingExperimentsForPicture.length > 0;
      
      // Check membership limits for registered users using token bucket algorithm
      if (args.userId) {
        
        // Only check limit if this picture hasn't been used yet
        if (!pictureHasBeenUsed) {
          const user = await ctx.db.get(args.userId);
          if (!user) {
            throw new Error("User not found");
          }

          // Get tier configuration (default to free if tier not found)
          const tierConfig = TIER_CONFIG[user.membershipTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.free;
          
          // Calculate current allotment with refill based on time since last experiment
          // Handle existing users who don't have experimentAllotment yet
          const currentStoredAllotment = user.experimentAllotment ?? tierConfig.maxAllotment;
          const refilledAllotment = calculateRefilledAllotment(
            currentStoredAllotment,
            user.lastExperimentAt,
            tierConfig
          );

          // console.log(`🎯 [${callId}] Allotment check:`, {
          //   tier: user.membershipTier,
          //   storedAllotment: currentStoredAllotment,
          //   lastExperimentAt: user.lastExperimentAt ? new Date(user.lastExperimentAt).toISOString() : 'never',
          //   refilledAllotment: refilledAllotment.toFixed(2),
          //   maxAllotment: tierConfig.maxAllotment,
          //   refillPerDay: tierConfig.refillPerDay,
          // });

          // Check if user has enough allotment (need at least 1)
          // Rate limiting is per-picture: 1 picture = 1 study
          if (refilledAllotment < 1) {
            const hoursUntilNextExperiment = ((1 - refilledAllotment) / tierConfig.refillPerDay) * 24;
            throw new RateLimitError(
              `Study limit reached. You'll be able to analyze another image in about ${Math.ceil(hoursUntilNextExperiment)} hour(s). ` +
              `Upgrade your plan for more studies!`
            );
          }
        }
      }

      // Check limits for anonymous/unregistered users (tracked by IP)
      // Limit applies per image, not per experiment - once an image is uploaded and used
      // (first experiment run), users can run all experiments on that image without additional limits
      let anonymousLimitRecord = null;
      let anonymousRefilledAllotment = ANONYMOUS_CONFIG.maxAllotment;
      let anonymousPictureHasBeenUsed = false;
      
      if (!args.userId && args.ipAddress) {
        // For anonymous users, picture is "used" if:
        // 1. It was uploaded by this IP (ownership check)
        // 2. It already has experiments (meaning the first experiment already ran)
        if (picture && picture.ipAddress === args.ipAddress && existingExperimentsForPicture.length > 0) {
          // This picture was uploaded by this IP and already has experiments - it's been "used"
          // This means the first experiment already counted toward the limit, so don't count this one
          anonymousPictureHasBeenUsed = true;
        }
        // If picture has no experiments yet, this will be the first one, so it counts toward the limit

        // Only check limit if this picture hasn't been used yet
        if (!anonymousPictureHasBeenUsed) {
          // Look up existing limit record for this IP
          anonymousLimitRecord = await ctx.db
            .query("anonymousExperimentLimits")
            .withIndex("by_ip", (q) => q.eq("ipAddress", args.ipAddress!))
            .first();

          if (anonymousLimitRecord) {
            // Calculate refilled allotment based on time since last image was used
            anonymousRefilledAllotment = calculateRefilledAllotment(
              anonymousLimitRecord.experimentAllotment,
              anonymousLimitRecord.lastExperimentAt,
              ANONYMOUS_CONFIG
            );
          }
          // If no record exists, user gets full allotment (handled by default value above)

          // console.log(`🎯 [${callId}] Anonymous allotment check:`, {
          //   ipAddress: args.ipAddress,
          //   hasExistingRecord: !!anonymousLimitRecord,
          //   refilledAllotment: anonymousRefilledAllotment.toFixed(2),
          //   maxAllotment: ANONYMOUS_CONFIG.maxAllotment,
          //   refillPerDay: ANONYMOUS_CONFIG.refillPerDay,
          //   pictureHasBeenUsed,
          // });

          // Check if anonymous user has enough allotment for a new image
          // Rate limiting is per-picture: 1 picture = 1 study
          if (anonymousRefilledAllotment < 1) {
            const daysUntilNextImage = (1 - anonymousRefilledAllotment) / ANONYMOUS_CONFIG.refillPerDay;
            throw new RateLimitError(
              `You've reached the limit for unregistered users (5 studies per month). ` +
              `You'll be able to analyze another image in about ${Math.ceil(daysUntilNextImage)} day(s). ` +
              `Register for free to get 3 studies per week!`
            );
          }
        }
      }

      // console.log(`📝 [${callId}] Inserting experiment into database...`)
      const experimentId = await ctx.db.insert("experiments", {
        pictureId: args.pictureId,
        userId: args.userId,
        experimentType: args.experimentType,
        parameters: args.parameters,
        status: "pending",
        createdAt: Date.now(),
      });
      
      // console.log(`✅ [${callId}] Experiment inserted with ID:`, experimentId)

      // Update user's experiment count and allotment
      // Rate limiting is per-picture (1 picture = 1 study/experiment for rate limiting)
      // Only increment experimentCount and decrement allotment if this picture hasn't been used yet (first experiment on this picture)
      if (args.userId) {
        const user = await ctx.db.get(args.userId);
        if (user) {
          // Only increment lifetime count and decrement allotment if this is the first experiment on this picture
          // This implements "1 picture = 1 study" for rate limiting purposes
          if (!pictureHasBeenUsed) {
            // Get tier configuration
            const tierConfig = TIER_CONFIG[user.membershipTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.free;
            
            // Increment lifetime count (for analytics) - this represents number of pictures studied
            const currentExperimentCount = (user.experimentCount ?? 0) + 1;
            
            // Recalculate refilled allotment and subtract 1 for this picture/study
            const currentStoredAllotment = user.experimentAllotment ?? tierConfig.maxAllotment;
            const refilledAllotment = calculateRefilledAllotment(
              currentStoredAllotment,
              user.lastExperimentAt,
              tierConfig
            );
            const newAllotment = Math.max(0, refilledAllotment - 1);

            // console.log(`📊 [${callId}] Updating user allotment:`, {
            //   previousStored: currentStoredAllotment,
            //   afterRefill: refilledAllotment.toFixed(2),
            //   afterDeduction: newAllotment.toFixed(2),
            // });

            await ctx.db.patch(args.userId, {
              experimentCount: currentExperimentCount,
              experimentAllotment: newAllotment,
              lastExperimentAt: Date.now(),
            });
          }
          // If picture already used, do nothing - user can run unlimited experiments on this picture
        }
      }

      // Update anonymous user's allotment (tracked by IP)
      // Only decrement if this picture hasn't been used yet (first experiment on this picture)
      if (!args.userId && args.ipAddress && !anonymousPictureHasBeenUsed) {
        const newAllotment = Math.max(0, anonymousRefilledAllotment - 1);

        // console.log(`📊 [${callId}] Updating anonymous allotment:`, {
        //   ipAddress: args.ipAddress,
        //   afterRefill: anonymousRefilledAllotment.toFixed(2),
        //   afterDeduction: newAllotment.toFixed(2),
        //   pictureHasBeenUsed,
        // });

        if (anonymousLimitRecord) {
          // Update existing record
          await ctx.db.patch(anonymousLimitRecord._id, {
            experimentAllotment: newAllotment,
            lastExperimentAt: Date.now(),
          });
        } else {
          // Create new record for this IP
          await ctx.db.insert("anonymousExperimentLimits", {
            ipAddress: args.ipAddress,
            experimentAllotment: newAllotment,
            lastExperimentAt: Date.now(),
          });
        }
      }

      return {
        experimentId,
        message: "Experiment created successfully",
      };
    } catch (error: any) {
      console.error("❌ Error in createExperiment:", {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        stack: error?.stack,
        error: error
      });
      
      // If it's a RateLimitError, preserve it
      if (error instanceof RateLimitError || error?.code === "RATE_LIMIT_EXCEEDED") {
        throw error; // Re-throw as-is to preserve the error code
      }
      
      // For other errors, wrap with more context
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      throw new Error(
        `Failed to create experiment: ${errorMessage}`
      );
    }
  },
});

// Get anonymous user's experiment allotment status (by IP address)
// Used by frontend to display remaining experiments and as client-side backup
export const getAnonymousAllotment = query({
  args: {
    ipAddress: v.string(),
  },
  returns: v.object({
    currentAllotment: v.number(),
    maxAllotment: v.number(),
    refillPerDay: v.number(),
    lastExperimentAt: v.optional(v.number()),
    hoursUntilNextExperiment: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const limitRecord = await ctx.db
      .query("anonymousExperimentLimits")
      .withIndex("by_ip", (q) => q.eq("ipAddress", args.ipAddress))
      .first();

    let currentAllotment = ANONYMOUS_CONFIG.maxAllotment;
    let lastExperimentAt: number | undefined = undefined;

    if (limitRecord) {
      currentAllotment = calculateRefilledAllotment(
        limitRecord.experimentAllotment,
        limitRecord.lastExperimentAt,
        ANONYMOUS_CONFIG
      );
      lastExperimentAt = limitRecord.lastExperimentAt;
    }

    // Calculate hours until next experiment if allotment < 1
    let hoursUntilNextExperiment: number | undefined = undefined;
    if (currentAllotment < 1) {
      const daysUntilNext = (1 - currentAllotment) / ANONYMOUS_CONFIG.refillPerDay;
      hoursUntilNextExperiment = Math.ceil(daysUntilNext * 24);
    }

    return {
      currentAllotment: Math.floor(currentAllotment), // Round down for display
      maxAllotment: ANONYMOUS_CONFIG.maxAllotment,
      refillPerDay: ANONYMOUS_CONFIG.refillPerDay,
      lastExperimentAt,
      hoursUntilNextExperiment,
    };
  },
});

// Get experiments by picture (for unregistered users)
export const getPictureExperiments = query({
  args: {
    pictureId: v.id("pictures"),
  },
  returns: v.array(
    v.object({
      _id: v.id("experiments"),
      _creationTime: v.number(),
      pictureId: v.id("pictures"),
      userId: v.optional(v.id("users")),
      experimentType: v.string(),
      parameters: v.optional(v.any()),
      results: v.optional(v.any()),
      eyeTrackingData: v.optional(v.any()),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      ),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const experiments = await ctx.db
      .query("experiments")
      .withIndex("by_picture", (q) => q.eq("pictureId", args.pictureId))
      .order("desc")
      .collect();

    return experiments;
  },
});

// Get user's experiments
export const getUserExperiments = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      _id: v.id("experiments"),
      _creationTime: v.number(),
      pictureId: v.id("pictures"),
      experimentType: v.string(),
      parameters: v.optional(v.any()),
      results: v.optional(v.any()),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      ),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
      eyeTrackingData: v.optional(v.object({
        gazePoints: v.array(v.object({
          x: v.number(),
          y: v.number(),
          timestamp: v.number(),
          confidence: v.optional(v.number())
        })),
        heatmapData: v.optional(v.any()),
        fixationPoints: v.optional(v.array(v.object({
          x: v.number(),
          y: v.number(),
          duration: v.number(),
          startTime: v.number()
        }))),
        scanPath: v.optional(v.array(v.object({
          x: v.number(),
          y: v.number(),
          timestamp: v.number(),
          confidence: v.optional(v.number())
        }))),
        sessionDuration: v.optional(v.number()),
        calibrationData: v.optional(v.any())
      })),
      picture: v.optional(
        v.object({
          _id: v.id("pictures"),
          fileName: v.string(),
          uploadedAt: v.number(),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const experiments = await ctx.db
      .query("experiments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    // Get picture details for each experiment
    // Explicitly construct return objects to match validator (exclude eyeTrackingData for this query)
    const experimentsWithPictures = await Promise.all(
      experiments.map(async (experiment) => {
        const picture = await ctx.db.get(experiment.pictureId);
        return {
          _id: experiment._id,
          _creationTime: experiment._creationTime,
          pictureId: experiment.pictureId,
          experimentType: experiment.experimentType,
          parameters: experiment.parameters,
          results: experiment.results,
          status: experiment.status,
          createdAt: experiment.createdAt,
          completedAt: experiment.completedAt,
          eyeTrackingData: experiment.eyeTrackingData, // Include it now that validator allows it
          picture: picture ? {
            _id: picture._id,
            fileName: picture.fileName,
            uploadedAt: picture.uploadedAt,
          } : undefined,
        };
      })
    );

    return experimentsWithPictures;
  },
});

// Update experiment results
export const updateExperimentResults = mutation({
  args: {
    experimentId: v.id("experiments"),
    results: v.any(),
    status: v.union(
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const experiment = await ctx.db.get(args.experimentId);
    if (!experiment) {
      return {
        success: false,
        message: "Experiment not found",
      };
    }

    await ctx.db.patch(args.experimentId, {
      results: args.results,
      status: args.status,
      completedAt: Date.now(),
    });

    return {
      success: true,
      message: "Experiment results updated",
    };
  },
});

// Update experiment with eye tracking data
export const updateEyeTrackingResults = mutation({
  args: {
    experimentId: v.id("experiments"),
    eyeTrackingData: v.object({
      gazePoints: v.array(v.object({
        x: v.number(),
        y: v.number(),
        timestamp: v.number(),
        confidence: v.optional(v.number())
      })),
      fixationPoints: v.optional(v.array(v.object({
        x: v.number(),
        y: v.number(),
        duration: v.number(),
        startTime: v.number()
      }))),
      scanPath: v.optional(v.array(v.object({
        x: v.number(),
        y: v.number(),
        timestamp: v.number(),
        confidence: v.optional(v.number())
      }))),
      sessionDuration: v.optional(v.number()),
      heatmapData: v.optional(v.any()),
      calibrationData: v.optional(v.any())
    }),
    status: v.union(
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const experiment = await ctx.db.get(args.experimentId);
    if (!experiment) {
      return {
        success: false,
        message: "Experiment not found",
      };
    }

    // Validate that this is an eye tracking experiment
    if (experiment.experimentType !== "Eye Tracking") {
      return {
        success: false,
        message: "This experiment is not an eye tracking experiment",
      };
    }

    await ctx.db.patch(args.experimentId, {
      eyeTrackingData: args.eyeTrackingData,
      results: {
        gazePointCount: args.eyeTrackingData.gazePoints.length,
        fixationCount: args.eyeTrackingData.fixationPoints?.length || 0,
        sessionDuration: args.eyeTrackingData.sessionDuration,
        averageConfidence: args.eyeTrackingData.gazePoints.length > 0 
          ? args.eyeTrackingData.gazePoints.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / args.eyeTrackingData.gazePoints.length
          : 0
      },
      status: args.status,
      completedAt: Date.now(),
    });

    return {
      success: true,
      message: "Eye tracking results updated successfully",
    };
  },
});

// Update experiment with Value Study results
// Accepts either processedImageStorageId (new format) or processedImageDataUrl (old format) for backward compatibility
export const updateValueStudyResults = mutation({
  args: {
    experimentId: v.id("experiments"),
    results: v.union(
      // New format: uses storage ID
      v.object({
        processedImageStorageId: v.id("_storage"),
        metadata: v.object({
          width: v.number(),
          height: v.number(),
          diagonal: v.number(),
          originalFormat: v.string(),
        }),
        parameters: v.object({
          levels: v.number(),
          smoothness: v.number(),
          useMedianBlur: v.optional(v.boolean()),
          meanCurvaturePasses: v.optional(v.number()),
        }),
      }),
      // Old format: uses data URL (for backward compatibility)
      v.object({
        processedImageDataUrl: v.string(),
        metadata: v.object({
          width: v.number(),
          height: v.number(),
          diagonal: v.number(),
          originalFormat: v.string(),
        }),
        parameters: v.object({
          levels: v.number(),
          smoothness: v.number(),
          useMedianBlur: v.optional(v.boolean()),
          meanCurvaturePasses: v.optional(v.number()),
        }),
      })
    ),
    status: v.union(
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const experiment = await ctx.db.get(args.experimentId);
      if (!experiment) {
        return {
          success: false,
          message: "Experiment not found",
        };
      }

      // Validate that this is a Value Study experiment
      if (experiment.experimentType !== "Value Study") {
        return {
          success: false,
          message: "This experiment is not a Value Study experiment",
        };
      }

      await ctx.db.patch(args.experimentId, {
        results: args.results,
        status: args.status,
        completedAt: Date.now(),
      });

      return {
        success: true,
        message: "Value Study results updated successfully",
      };
    } catch (error: any) {
      console.error("Error updating Value Study results:", error);
      return {
        success: false,
        message: `Failed to update results: ${error.message || 'Unknown error'}`,
      };
    }
  },
});

// Update experiment with Edge Detection results
// Accepts either processedImageStorageId (new format) or processedImageDataUrl (old format) for backward compatibility
export const updateEdgeDetectionResults = mutation({
  args: {
    experimentId: v.id("experiments"),
    results: v.union(
      // New format: uses storage ID
      v.object({
        processedImageStorageId: v.id("_storage"),
        metadata: v.object({
          width: v.number(),
          height: v.number(),
          diagonal: v.number(),
          originalFormat: v.string(),
        }),
        parameters: v.object({
          blurRadius: v.number(),
          threshold: v.number(),
          invert: v.optional(v.boolean()),
        }),
      }),
      // Old format: uses data URL (for backward compatibility)
      v.object({
        processedImageDataUrl: v.string(),
        metadata: v.object({
          width: v.number(),
          height: v.number(),
          diagonal: v.number(),
          originalFormat: v.string(),
        }),
        parameters: v.object({
          blurRadius: v.number(),
          threshold: v.number(),
          invert: v.optional(v.boolean()),
        }),
      })
    ),
    status: v.union(
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const experiment = await ctx.db.get(args.experimentId);
      if (!experiment) {
        return {
          success: false,
          message: "Experiment not found",
        };
      }

      // Validate that this is an Edge Detection experiment
      if (experiment.experimentType !== "Edge Detection") {
        return {
          success: false,
          message: "This experiment is not an Edge Detection experiment",
        };
      }

      await ctx.db.patch(args.experimentId, {
        results: args.results,
        status: args.status,
        completedAt: Date.now(),
      });

      return {
        success: true,
        message: "Edge Detection results updated successfully",
      };
    } catch (error: any) {
      console.error("Error updating Edge Detection results:", error);
      return {
        success: false,
        message: `Failed to update results: ${error.message || 'Unknown error'}`,
      };
    }
  },
});

// Get experiment details
export const getExperiment = query({
  args: {
    experimentId: v.id("experiments"),
    userId: v.optional(v.id("users")),
  },
  returns: v.union(
    v.object({
      _id: v.id("experiments"),
      _creationTime: v.number(),
      pictureId: v.id("pictures"),
      userId: v.optional(v.id("users")),
      experimentType: v.string(),
      parameters: v.optional(v.any()),
      results: v.optional(v.any()),
      eyeTrackingData: v.optional(v.object({
        gazePoints: v.array(v.object({
          x: v.number(),
          y: v.number(),
          timestamp: v.number(),
          confidence: v.optional(v.number())
        })),
        heatmapData: v.optional(v.any()),
        fixationPoints: v.optional(v.array(v.object({
          x: v.number(),
          y: v.number(),
          duration: v.number(),
          startTime: v.number()
        }))),
        scanPath: v.optional(v.array(v.object({
          x: v.number(),
          y: v.number(),
          timestamp: v.number(),
          confidence: v.optional(v.number())
        }))),
        sessionDuration: v.optional(v.number()),
        calibrationData: v.optional(v.any())
      })),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      ),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const experiment = await ctx.db.get(args.experimentId);
    if (!experiment) {
      return null;
    }

    // Check access
    if (args.userId && experiment.userId !== args.userId) {
      return null;
    }

    // Explicitly construct return object to match validator
    return {
      _id: experiment._id,
      _creationTime: experiment._creationTime,
      pictureId: experiment.pictureId,
      userId: experiment.userId,
      experimentType: experiment.experimentType,
      parameters: experiment.parameters,
      results: experiment.results,
      eyeTrackingData: experiment.eyeTrackingData, // Include it now that validator allows it
      status: experiment.status,
      createdAt: experiment.createdAt,
      completedAt: experiment.completedAt,
    };
  },
});

// Get most recent completed experiment of a specific type for a picture
export const getExistingExperiment = query({
  args: {
    pictureId: v.id("pictures"),
    experimentType: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("experiments"),
      _creationTime: v.number(),
      pictureId: v.id("pictures"),
      userId: v.optional(v.id("users")),
      experimentType: v.string(),
      parameters: v.optional(v.any()),
      results: v.optional(v.any()),
      eyeTrackingData: v.optional(v.any()),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      ),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Find the most recent completed experiment of this type for this picture
    const experiments = await ctx.db
      .query("experiments")
      .withIndex("by_picture", (q) => q.eq("pictureId", args.pictureId))
      .filter((q) => q.eq(q.field("experimentType"), args.experimentType))
      .order("desc")
      .collect();

    // Return the most recent completed experiment, or null if none found
    const completed = experiments.find(exp => exp.status === "completed");
    if (completed) {
      return {
        _id: completed._id,
        _creationTime: completed._creationTime,
        pictureId: completed.pictureId,
        userId: completed.userId,
        experimentType: completed.experimentType,
        parameters: completed.parameters,
        results: completed.results,
        eyeTrackingData: completed.eyeTrackingData,
        status: completed.status,
        createdAt: completed.createdAt,
        completedAt: completed.completedAt,
      };
    }
    
    return null;
  },
});

// Get most recent calibration data for a user
export const getMostRecentCalibration = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  returns: v.union(
    v.object({
      experimentId: v.id("experiments"),
      calibrationData: v.any(),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    if (!args.userId) {
      return null
    }

    // Find the most recent completed eye tracking experiment with calibration data
    const experiments = await ctx.db
      .query("experiments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId!))
      .filter((q) => 
        q.and(
          q.eq(q.field("experimentType"), "Eye Tracking"),
          q.eq(q.field("status"), "completed")
        )
      )
      .order("desc")
      .collect()

    // Find the first experiment with calibration data
    for (const experiment of experiments) {
      if (experiment.eyeTrackingData?.calibrationData) {
        return {
          experimentId: experiment._id,
          calibrationData: experiment.eyeTrackingData.calibrationData,
          createdAt: experiment.createdAt,
        }
      }
    }

    return null
  },
});

// Debug query to see experiments for a picture with details
export const debugPictureExperiments = query({
  args: {
    pictureId: v.id("pictures"),
  },
  returns: v.array(
    v.object({
      _id: v.id("experiments"),
      _creationTime: v.number(),
      pictureId: v.id("pictures"),
      userId: v.optional(v.id("users")),
      experimentType: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      ),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
      hasEyeTrackingData: v.boolean(),
      gazePointCount: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const experiments = await ctx.db
      .query("experiments")
      .withIndex("by_picture", (q) => q.eq("pictureId", args.pictureId))
      .order("desc")
      .collect();

    return experiments.map(exp => ({
      _id: exp._id,
      _creationTime: exp._creationTime,
      pictureId: exp.pictureId,
      userId: exp.userId,
      experimentType: exp.experimentType,
      status: exp.status,
      createdAt: exp.createdAt,
      completedAt: exp.completedAt,
      hasEyeTrackingData: !!exp.eyeTrackingData,
      gazePointCount: exp.eyeTrackingData?.gazePoints?.length || 0,
    }));
  },
});

// Clean up duplicate experiments for a picture (keep only the most recent)
export const cleanupDuplicateExperiments = mutation({
  args: {
    pictureId: v.id("pictures"),
  },
  returns: v.object({
    deletedCount: v.number(),
    keptExperimentId: v.optional(v.id("experiments")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get all experiments for this picture
    const experiments = await ctx.db
      .query("experiments")
      .withIndex("by_picture", (q) => q.eq("pictureId", args.pictureId))
      .order("desc")
      .collect();

    if (experiments.length <= 1) {
      return {
        deletedCount: 0,
        keptExperimentId: experiments[0]?._id,
        message: "No duplicates found",
      };
    }

    // Group experiments by type and user
    const groupedExperiments = new Map<string, typeof experiments>();
    
    experiments.forEach(exp => {
      const key = `${exp.experimentType}-${exp.userId || 'anonymous'}`;
      if (!groupedExperiments.has(key)) {
        groupedExperiments.set(key, []);
      }
      groupedExperiments.get(key)!.push(exp);
    });

    let deletedCount = 0;
    let keptExperimentId: string | undefined;

    // For each group, keep only the most recent (first in desc order)
    for (const [key, group] of groupedExperiments) {
      if (group.length > 1) {
        // Keep the first one (most recent), delete the rest
        const toKeep = group[0];
        const toDelete = group.slice(1);
        
        keptExperimentId = toKeep._id;
        
        // Delete the duplicates
        for (const exp of toDelete) {
          await ctx.db.delete(exp._id);
          deletedCount++;
        }
      } else if (group.length === 1) {
        keptExperimentId = group[0]._id;
      }
    }

    return {
      deletedCount,
      keptExperimentId: keptExperimentId as any,
      message: `Cleaned up ${deletedCount} duplicate experiment(s)`,
    };
  },
});

// Clear all experiments for a specific picture (preserves pictures and users)
export const clearPictureExperiments = mutation({
  args: {
    pictureId: v.id("pictures"),
  },
  returns: v.object({
    deletedCount: v.number(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get all experiments for this picture
    const experiments = await ctx.db
      .query("experiments")
      .withIndex("by_picture", (q) => q.eq("pictureId", args.pictureId))
      .collect();

    let deletedCount = 0;

    // Delete all experiments for this picture
    for (const experiment of experiments) {
      await ctx.db.delete(experiment._id);
      deletedCount++;
    }

    return {
      deletedCount,
      message: `Cleared ${deletedCount} experiment(s) for picture ${args.pictureId}`,
    };
  },
});

// Clear all experiments for a specific user (preserves pictures and users)
export const clearUserExperiments = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    deletedCount: v.number(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get all experiments for this user
    const experiments = await ctx.db
      .query("experiments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let deletedCount = 0;

    // Delete all experiments for this user
    for (const experiment of experiments) {
      await ctx.db.delete(experiment._id);
      deletedCount++;
    }

    // Reset user's experiment count and refill allotment
    const user = await ctx.db.get(args.userId);
    if (user) {
      const tierConfig = TIER_CONFIG[user.membershipTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.free;
      await ctx.db.patch(args.userId, {
        experimentCount: 0,
        experimentAllotment: tierConfig.maxAllotment,
        lastExperimentAt: undefined,
      });
    }

    return {
      deletedCount,
      message: `Cleared ${deletedCount} experiment(s) for user ${args.userId}`,
    };
  },
});

// Clear all experiments with empty gaze data (failed experiments)
export const clearEmptyExperiments = mutation({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get all experiments
    const experiments = await ctx.db
      .query("experiments")
      .collect();

    let deletedCount = 0;

    // Delete experiments with empty or invalid eye tracking data
    for (const experiment of experiments) {
      if (experiment.experimentType === "Eye Tracking" && experiment.eyeTrackingData) {
        const gazePoints = experiment.eyeTrackingData.gazePoints || [];
        const fixationPoints = experiment.eyeTrackingData.fixationPoints || [];
        
        // Delete if no gaze points or all gaze points are at (0,0)
        const hasValidData = gazePoints.length > 0 && 
          gazePoints.some(point => point.x !== 0 || point.y !== 0);
        
        if (!hasValidData) {
          await ctx.db.delete(experiment._id);
          deletedCount++;
        }
      }
    }

    return {
      deletedCount,
      message: `Cleared ${deletedCount} experiment(s) with empty gaze data`,
    };
  },
});

// Clear all experiments (DANGER: This removes ALL experiment data)
export const clearAllExperiments = mutation({
  args: {
    confirm: v.string(), // Must be "DELETE_ALL_EXPERIMENTS" to confirm
  },
  returns: v.object({
    deletedCount: v.number(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    if (args.confirm !== "DELETE_ALL_EXPERIMENTS") {
      throw new Error("Confirmation string required. Pass 'DELETE_ALL_EXPERIMENTS' to confirm.");
    }

    // Get all experiments
    const experiments = await ctx.db
      .query("experiments")
      .collect();

    let deletedCount = 0;

    // Delete all experiments
    for (const experiment of experiments) {
      await ctx.db.delete(experiment._id);
      deletedCount++;
    }

    // Reset all users' experiment counts and refill allotments
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      const tierConfig = TIER_CONFIG[user.membershipTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.free;
      await ctx.db.patch(user._id, {
        experimentCount: 0,
        experimentAllotment: tierConfig.maxAllotment,
        lastExperimentAt: undefined,
      });
    }

    return {
      deletedCount,
      message: `Cleared ALL ${deletedCount} experiment(s) from the database`,
    };
  },
});

// Delete a single experiment
export const deleteExperiment = mutation({
  args: {
    experimentId: v.id("experiments"),
    userId: v.optional(v.id("users")),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const experiment = await ctx.db.get(args.experimentId);
    
    if (!experiment) {
      return {
        success: false,
        message: "Experiment not found",
      };
    }

    // Check ownership (if userId is provided)
    if (args.userId && experiment.userId !== args.userId) {
      return {
        success: false,
        message: "Not authorized to delete this experiment",
      };
    }

    // Delete the experiment
    await ctx.db.delete(experiment._id);

    return {
      success: true,
      message: "Experiment deleted successfully",
    };
  },
});

// Get database statistics
export const getDatabaseStats = query({
  args: {},
  returns: v.object({
    totalExperiments: v.number(),
    totalPictures: v.number(),
    totalUsers: v.number(),
    experimentsByType: v.record(v.string(), v.number()),
    experimentsByStatus: v.record(v.string(), v.number()),
    emptyExperiments: v.number(),
  }),
  handler: async (ctx, args) => {
    const experiments = await ctx.db.query("experiments").collect();
    const pictures = await ctx.db.query("pictures").collect();
    const users = await ctx.db.query("users").collect();

    // Count by experiment type
    const experimentsByType: Record<string, number> = {};
    experiments.forEach(exp => {
      experimentsByType[exp.experimentType] = (experimentsByType[exp.experimentType] || 0) + 1;
    });

    // Count by status
    const experimentsByStatus: Record<string, number> = {};
    experiments.forEach(exp => {
      experimentsByStatus[exp.status] = (experimentsByStatus[exp.status] || 0) + 1;
    });

    // Count empty experiments
    let emptyExperiments = 0;
    experiments.forEach(exp => {
      if (exp.experimentType === "Eye Tracking" && exp.eyeTrackingData) {
        const gazePoints = exp.eyeTrackingData.gazePoints || [];
        const hasValidData = gazePoints.length > 0 && 
          gazePoints.some(point => point.x !== 0 || point.y !== 0);
        if (!hasValidData) {
          emptyExperiments++;
        }
      }
    });

    return {
      totalExperiments: experiments.length,
      totalPictures: pictures.length,
      totalUsers: users.length,
      experimentsByType,
      experimentsByStatus,
      emptyExperiments,
    };
  },
});
