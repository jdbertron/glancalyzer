import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Create a new experiment
export const createExperiment = mutation({
  args: {
    pictureId: v.id("pictures"),
    userId: v.optional(v.id("users")),
    experimentType: v.string(),
    parameters: v.optional(v.any()),
  },
  returns: v.object({
    experimentId: v.id("experiments"),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const callId = Math.random().toString(36).substring(2, 15)
    const timestamp = new Date().toISOString()
    
    console.log(`🔧 [${callId}] createExperiment called at ${timestamp}`)
    console.log(`🔧 [${callId}] Args:`, {
      pictureId: args.pictureId,
      userId: args.userId,
      experimentType: args.experimentType,
      parameters: args.parameters
    })
    
    // Check for existing experiments for this picture
    const existingExperiments = await ctx.db
      .query("experiments")
      .withIndex("by_picture", (q) => q.eq("pictureId", args.pictureId))
      .collect();
    
    console.log(`🔍 [${callId}] Found ${existingExperiments.length} existing experiments for this picture`)
    if (existingExperiments.length > 0) {
      console.log(`🔍 [${callId}] Existing experiments:`, existingExperiments.map(exp => ({
        id: exp._id,
        type: exp.experimentType,
        status: exp.status,
        createdAt: new Date(exp.createdAt).toISOString()
      })))
    }
    
    // Check if picture exists and user has access
    const picture = await ctx.db.get(args.pictureId);
    if (!picture) {
      console.log(`❌ [${callId}] Picture not found:`, args.pictureId)
      throw new Error("Picture not found");
    }

    if (picture.isExpired) {
      throw new Error("Picture has expired");
    }

    // Check ownership for registered users
    if (args.userId && picture.userId !== args.userId) {
      throw new Error("Not authorized to create experiments on this picture");
    }

    // Check membership limits for registered users
    if (args.userId) {
      const user = await ctx.db.get(args.userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Get user's current experiment count
      const userExperiments = await ctx.db
        .query("experiments")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();

      const currentCount = userExperiments.length;

      // Check membership tier limits
      const tierLimits = {
        free: 5,
        basic: 50,
        premium: 200,
        enterprise: 1000,
      };

      if (currentCount >= tierLimits[user.membershipTier]) {
        throw new Error(`Experiment limit reached for ${user.membershipTier} tier`);
      }
    }

    console.log(`📝 [${callId}] Inserting experiment into database...`)
    const experimentId = await ctx.db.insert("experiments", {
      pictureId: args.pictureId,
      userId: args.userId,
      experimentType: args.experimentType,
      parameters: args.parameters,
      status: "pending",
      createdAt: Date.now(),
    });
    
    console.log(`✅ [${callId}] Experiment inserted with ID:`, experimentId)

    // Update user's experiment count
    if (args.userId) {
      const user = await ctx.db.get(args.userId);
      if (user) {
        await ctx.db.patch(args.userId, {
          experimentCount: user.experimentCount + 1,
        });
      }
    }

    return {
      experimentId,
      message: "Experiment created successfully",
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
    const experimentsWithPictures = await Promise.all(
      experiments.map(async (experiment) => {
        const picture = await ctx.db.get(experiment.pictureId);
        return {
          ...experiment,
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

    return experiment;
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

    // Reset user's experiment count
    const user = await ctx.db.get(args.userId);
    if (user) {
      await ctx.db.patch(args.userId, {
        experimentCount: 0,
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

    // Reset all users' experiment counts
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.db.patch(user._id, {
        experimentCount: 0,
      });
    }

    return {
      deletedCount,
      message: `Cleared ALL ${deletedCount} experiment(s) from the database`,
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
