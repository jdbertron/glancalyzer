import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Include Convex Auth tables
  ...authTables,

  // Users table - extends the auth users table with app-specific fields
  // Note: The authTables includes a 'users' table, but we define our own with additional fields
  users: defineTable({
    // Auth fields (managed by Convex Auth)
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    // Legacy field for backward compatibility with existing users
    emailVerified: v.optional(v.boolean()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    // App-specific fields
    membershipTier: v.optional(v.union(
      v.literal("free"),
      v.literal("premium"),
      v.literal("professional")
    )),
    experimentCount: v.optional(v.number()), // Lifetime count (for analytics, never decremented)
    // Token bucket rate limiting for experiments
    experimentAllotment: v.optional(v.number()), // Current available experiments (refills over time)
    lastExperimentAt: v.optional(v.number()), // Timestamp of last experiment (for refill calculation)
    createdAt: v.optional(v.number()),
    lastActiveAt: v.optional(v.number()),
    // Stripe subscription fields
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
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
    stripeCurrentPeriodEnd: v.optional(v.number()), // Subscription period end timestamp
  }).index("by_email", ["email"])
    .index("by_stripe_customer_id", ["stripeCustomerId"]),

  // Pictures uploaded by users
  pictures: defineTable({
    userId: v.optional(v.id("users")), // null for unregistered users
    fileName: v.string(),
    fileId: v.id("_storage"),
    fileHash: v.optional(v.string()), // SHA-256 hash for duplicate detection (optional for existing records)
    fileSize: v.optional(v.number()), // File size in bytes (optional for existing records)
    uploadedAt: v.number(),
    ipAddress: v.optional(v.string()), // for rate limiting
    userAgent: v.optional(v.string()),
    // Legacy fields for existing records (will be removed in future)
    expiresAt: v.optional(v.number()),
    isExpired: v.optional(v.boolean()),
    // Composition classification results
    compositionProbabilities: v.optional(v.any()), // JSON object with composition class probabilities
  }).index("by_user", ["userId"])
    .index("by_file_hash", ["fileHash"])
    .index("by_ip", ["ipAddress"]),

  // Experiments performed on pictures
  experiments: defineTable({
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
    // Eye tracking specific data
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
  }).index("by_picture", ["pictureId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_experiment_type", ["experimentType"]),

  // Rate limiting for IP addresses (1 minute cooldown for uploads)
  rateLimits: defineTable({
    ipAddress: v.string(),
    lastUploadAt: v.number(),
    uploadCount: v.number(),
    windowStart: v.number(),
    cooldownUntil: v.number(), // Timestamp when cooldown expires
  }).index("by_ip", ["ipAddress"])
    .index("by_cooldown", ["cooldownUntil"]),

  // Experiment rate limiting for anonymous/unregistered users (tracked by IP)
  // Uses token bucket algorithm: 5 experiments per month
  anonymousExperimentLimits: defineTable({
    ipAddress: v.string(),
    experimentAllotment: v.number(), // Current available experiments
    lastExperimentAt: v.optional(v.number()), // Timestamp of last experiment
  }).index("by_ip", ["ipAddress"]),

  // Membership tiers configuration
  membershipTiers: defineTable({
    name: v.string(),
    maxExperiments: v.number(),
    pricePerMonth: v.number(),
    features: v.array(v.string()),
    isActive: v.boolean(),
  }).index("by_name", ["name"]),
});
