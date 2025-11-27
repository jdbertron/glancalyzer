// Stripe helper functions - queries and mutations for database operations
// These run in Convex's V8 runtime (not Node.js)

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// Map Stripe Price IDs back to your tier names
// Keep this in sync with stripe.ts
const PRICE_ID_TO_TIER: Record<string, "free" | "premium" | "professional"> = {
  "price_1SXx0c7V9tItl45c8JZvML7I": "premium",
  "price_1SXx237V9tItl45ctNL6t031": "professional",
};

/**
 * Internal query to get user data for checkout session creation.
 */
export const getUserForCheckout = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      email: v.optional(v.string()),
      stripeCustomerId: v.optional(v.string()),
      membershipTier: v.optional(v.union(
        v.literal("free"),
        v.literal("premium"),
        v.literal("professional")
      )),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return {
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
      membershipTier: user.membershipTier,
    };
  },
});

/**
 * Internal mutation to save Stripe customer ID to user record.
 */
export const updateStripeCustomerId = internalMutation({
  args: {
    userId: v.id("users"),
    stripeCustomerId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      stripeCustomerId: args.stripeCustomerId,
    });
    return null;
  },
});

/**
 * Internal query to find user by Stripe customer ID.
 */
export const getUserByStripeCustomerId = internalQuery({
  args: {
    stripeCustomerId: v.string(),
  },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer_id", (q) => 
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .unique();
    return user?._id ?? null;
  },
});

/**
 * Internal mutation to update user subscription status.
 * Called by the webhook handler when subscription events occur.
 */
export const updateSubscription = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripeSubscriptionStatus: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("past_due"),
      v.literal("trialing"),
      v.literal("unpaid"),
      v.literal("paused")
    ),
    stripePriceId: v.string(),
    stripeCurrentPeriodEnd: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find the user by Stripe customer ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer_id", (q) => 
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .unique();
    
    if (!user) {
      console.error(`No user found for Stripe customer: ${args.stripeCustomerId}`);
      return null;
    }

    // Determine the membership tier from the price ID
    let membershipTier: "free" | "premium" | "professional" = "free";
    if (args.stripeSubscriptionStatus === "active" || args.stripeSubscriptionStatus === "trialing") {
      membershipTier = PRICE_ID_TO_TIER[args.stripePriceId] ?? "free";
    }

    // Get tier config to reset allotment
    const TIER_CONFIG = {
      free: { maxAllotment: 3 },
      premium: { maxAllotment: 100 },
      professional: { maxAllotment: 500 },
    } as const;

    const tierConfig = TIER_CONFIG[membershipTier];

    // Update the user's subscription fields
    await ctx.db.patch(user._id, {
      membershipTier,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeSubscriptionStatus: args.stripeSubscriptionStatus,
      stripeCurrentPeriodEnd: args.stripeCurrentPeriodEnd,
      // Reset experiment allotment to new tier's max on upgrade
      experimentAllotment: tierConfig.maxAllotment,
    });

    console.log(`Updated subscription for user ${user._id}: tier=${membershipTier}, status=${args.stripeSubscriptionStatus}`);
    return null;
  },
});

/**
 * Internal mutation to handle subscription cancellation/deletion.
 */
export const cancelSubscription = internalMutation({
  args: {
    stripeCustomerId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer_id", (q) => 
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .unique();
    
    if (!user) {
      console.error(`No user found for Stripe customer: ${args.stripeCustomerId}`);
      return null;
    }

    // Reset to free tier
    await ctx.db.patch(user._id, {
      membershipTier: "free",
      stripeSubscriptionId: undefined,
      stripeSubscriptionStatus: undefined,
      stripeCurrentPeriodEnd: undefined,
      experimentAllotment: 3, // Free tier allotment
    });

    console.log(`Cancelled subscription for user ${user._id}, reverted to free tier`);
    return null;
  },
});

