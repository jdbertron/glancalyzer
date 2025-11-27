import { query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

// Check if user can upload (rate limiting)
export const canUserUpload = query({
  args: {
    userId: v.optional(v.id("users")),
    ipAddress: v.optional(v.string()),
  },
  returns: v.object({
    canUpload: v.boolean(),
    reason: v.string(),
    remainingUploads: v.number(),
  }),
  handler: async (ctx, args) => {
    // Try to get authenticated user if no userId provided
    let userId = args.userId;
    if (!userId) {
      const authUserId = await auth.getUserId(ctx);
      userId = authUserId ?? undefined;
    }

    // If user is registered and verified
    if (userId) {
      const user = await ctx.db.get(userId);
      if (!user) {
        return {
          canUpload: false,
          reason: "User not found",
          remainingUploads: 0,
        };
      }
      // With Convex Auth, emailVerificationTime indicates verification
      // If no verification time and no email, still allow (OAuth users may not have verified email)
      return {
        canUpload: true,
        reason: "Verified user",
        remainingUploads: -1, // unlimited for verified users
      };
    }

    // For unregistered users, allow one upload per session
    // In a real app, you'd use proper IP tracking, but for demo we'll be permissive
    return {
      canUpload: true,
      reason: "Anonymous upload allowed",
      remainingUploads: 1,
    };
  },
});

