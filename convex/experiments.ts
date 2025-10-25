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
    // Check if picture exists and user has access
    const picture = await ctx.db.get(args.pictureId);
    if (!picture) {
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

    const experimentId = await ctx.db.insert("experiments", {
      pictureId: args.pictureId,
      userId: args.userId,
      experimentType: args.experimentType,
      parameters: args.parameters,
      status: "pending",
      createdAt: Date.now(),
    });

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

// Get experiments for a picture
export const getPictureExperiments = query({
  args: {
    pictureId: v.id("pictures"),
    userId: v.optional(v.id("users")),
  },
  returns: v.array(
    v.object({
      _id: v.id("experiments"),
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
    })
  ),
  handler: async (ctx, args) => {
    const picture = await ctx.db.get(args.pictureId);
    if (!picture) {
      return [];
    }

    // Check access
    if (args.userId && picture.userId !== args.userId) {
      return [];
    }

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
        timestamp: v.number()
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
