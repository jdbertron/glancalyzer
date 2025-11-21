import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table with email verification
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    emailVerified: v.boolean(),
    membershipTier: v.union(
      v.literal("free"),
      v.literal("basic"),
      v.literal("premium"),
      v.literal("enterprise")
    ),
    experimentCount: v.number(),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  }).index("by_email", ["email"]),

  // Email verification tokens
  emailVerificationTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

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

  // Rate limiting for IP addresses (1 minute cooldown)
  rateLimits: defineTable({
    ipAddress: v.string(),
    lastUploadAt: v.number(),
    uploadCount: v.number(),
    windowStart: v.number(),
    cooldownUntil: v.number(), // Timestamp when cooldown expires
  }).index("by_ip", ["ipAddress"])
    .index("by_cooldown", ["cooldownUntil"]),

  // Membership tiers configuration
  membershipTiers: defineTable({
    name: v.string(),
    maxExperiments: v.number(),
    pricePerMonth: v.number(),
    features: v.array(v.string()),
    isActive: v.boolean(),
  }).index("by_name", ["name"]),
});
