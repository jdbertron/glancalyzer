import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

// Get the current authenticated user
export const viewer = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      membershipTier: v.optional(v.union(
        v.literal("free"),
        v.literal("premium"),
        v.literal("professional")
      )),
      experimentCount: v.optional(v.number()),
      experimentAllotment: v.optional(v.number()),
      lastExperimentAt: v.optional(v.number()),
      createdAt: v.optional(v.number()),
      lastActiveAt: v.optional(v.number()),
      // Stripe subscription fields
      stripeSubscriptionStatus: v.optional(v.union(
        v.literal("active"),
        v.literal("canceled"),
        v.literal("incomplete"),
        v.literal("incomplete_expired"),
        v.literal("past_due"),
        v.literal("trialing"),
        v.literal("unpaid"),
        v.literal("paused")
      )),
      stripeCurrentPeriodEnd: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (userId === null) {
      return null;
    }
    
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      image: user.image,
      membershipTier: user.membershipTier,
      experimentCount: user.experimentCount,
      experimentAllotment: user.experimentAllotment,
      lastExperimentAt: user.lastExperimentAt,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      // Stripe subscription fields
      stripeSubscriptionStatus: user.stripeSubscriptionStatus,
      stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd,
    };
  },
});

// Initialize user profile after first sign-up
// This is called automatically by Convex Auth after account creation
export const initializeProfile = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (userId === null) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    // Only initialize if not already done (check for membershipTier)
    if (user.membershipTier === undefined) {
      const now = Date.now();
      const FREE_TIER_MAX_ALLOTMENT = 3;
      
      await ctx.db.patch(userId, {
        membershipTier: "free",
        experimentCount: 0,
        experimentAllotment: FREE_TIER_MAX_ALLOTMENT,
        createdAt: now,
        lastActiveAt: now,
      });
    }

    return null;
  },
});

// Update user's last active time
export const updateLastActive = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (userId === null) {
      return null;
    }

    await ctx.db.patch(userId, {
      lastActiveAt: Date.now(),
    });

    return null;
  },
});

