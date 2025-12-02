"use node";

// Stripe actions - these run in Node.js runtime for Stripe API access
// Database operations are in stripeHelpers.ts (V8 runtime)

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";
import { auth } from "./auth";
import { getAuthUserId } from "@convex-dev/auth/server";

// Initialize Stripe with the secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover",
});

// Map your membership tiers to Stripe Price IDs
// You'll create these products/prices in Stripe Dashboard and paste the IDs here
const TIER_TO_PRICE_ID: Record<string, string> = {
  premium: "price_1SXx0c7V9tItl45c8JZvML7I",
  professional: "price_1SXx237V9tItl45ctNL6t031",
};

/**
 * Create a Stripe Checkout Session for upgrading to a paid tier.
 * Returns a URL to redirect the user to Stripe's hosted checkout page.
 */
export const createCheckoutSession = action({
  args: {
    tier: v.union(v.literal("premium"), v.literal("professional")),
  },
  returns: v.object({
    url: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get the authenticated user
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to upgrade your subscription");
    }

    // Get user data including email and existing Stripe customer ID
    const user = await ctx.runQuery(internal.stripeHelpers.getUserForCheckout, { userId });
    if (!user) {
      throw new Error("User not found");
    }

    // Get or create a Stripe customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          convexUserId: userId,
        },
      });
      stripeCustomerId = customer.id;
      
      // Save the customer ID to the user record
      await ctx.runMutation(internal.stripeHelpers.updateStripeCustomerId, {
        userId,
        stripeCustomerId,
      });
    }

    // Get the price ID for the selected tier
    const priceId = TIER_TO_PRICE_ID[args.tier];
    if (!priceId || priceId.includes("REPLACE")) {
      throw new Error(`Price ID not configured for tier: ${args.tier}. Please update TIER_TO_PRICE_ID in stripe.ts`);
    }

    // Determine success and cancel URLs
    // These should point to your frontend pages
    const baseUrl = process.env.SITE_URL || "http://localhost:5173";
    
    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/profile?checkout=success`,
      cancel_url: `${baseUrl}/profile?checkout=canceled`,
      metadata: {
        convexUserId: userId,
        tier: args.tier,
      },
      subscription_data: {
        metadata: {
          convexUserId: userId,
          tier: args.tier,
        },
      },
    });

    if (!session.url) {
      throw new Error("Failed to create checkout session");
    }

    return { url: session.url };
  },
});

/**
 * Create a Stripe Customer Portal session for managing subscriptions.
 * Returns a URL to redirect the user to Stripe's billing portal.
 */
export const createCustomerPortalSession = action({
  args: {},
  returns: v.object({
    url: v.string(),
  }),
  handler: async (ctx) => {
    // Get the authenticated user
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to manage your subscription");
    }

    // Get user's Stripe customer ID
    const user = await ctx.runQuery(internal.stripeHelpers.getUserForCheckout, { userId });
    if (!user?.stripeCustomerId) {
      throw new Error("No subscription found. Please subscribe first.");
    }

    const baseUrl = process.env.SITE_URL || "http://localhost:5173";

    // Create the portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/profile`,
    });

    return { url: session.url };
  },
});
