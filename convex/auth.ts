import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Generate a random verification token
function generateToken(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Register a new user (unverified)
export const registerUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  returns: v.object({
    userId: v.id("users"),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    let userId: Id<"users">;

    if (existingUser) {
      if (existingUser.emailVerified) {
        throw new Error("User already exists and is verified");
      } else {
        // User exists but not verified - update name if provided and resend verification
        userId = existingUser._id;
        
        // Update user info if name is provided
        if (args.name) {
          await ctx.db.patch(userId, {
            name: args.name,
            lastActiveAt: Date.now(),
          });
        } else {
          await ctx.db.patch(userId, {
            lastActiveAt: Date.now(),
          });
        }

        // Invalidate old unused tokens for this user
        const oldTokens = await ctx.db
          .query("emailVerificationTokens")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .collect();
        
        // Mark all unused tokens as used
        for (const oldToken of oldTokens) {
          if (!oldToken.used) {
            await ctx.db.patch(oldToken._id, { used: true });
          }
        }
      }
    } else {
      // Create new user
      userId = await ctx.db.insert("users", {
        email: args.email,
        name: args.name,
        emailVerified: false,
        membershipTier: "free",
        experimentCount: 0,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      });
    }

    // Generate new verification token
    const token = generateToken();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    await ctx.db.insert("emailVerificationTokens", {
      userId,
      token,
      expiresAt,
      used: false,
    });

    // Schedule email sending (in a real app, you'd use an email service)
    await ctx.scheduler.runAfter(0, internal.auth.sendVerificationEmail, {
      userId,
      email: args.email,
      token,
    });

    return {
      userId,
      message: existingUser && !existingUser.emailVerified
        ? "Verification email resent. Please check your email."
        : "Registration successful. Please check your email for verification.",
    };
  },
});

// Login - find user by email (for verified users)
export const loginUser = mutation({
  args: {
    email: v.string(),
  },
  returns: v.object({
    userId: v.id("users"),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("User not found. Please register first.");
    }

    if (!user.emailVerified) {
      throw new Error("Email not verified. Please check your email for verification link.");
    }

    // Update last active time
    await ctx.db.patch(user._id, {
      lastActiveAt: Date.now(),
    });

    return {
      userId: user._id,
      message: "Login successful",
    };
  },
});

// Verify email with token
export const verifyEmail = mutation({
  args: {
    token: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const tokenRecord = await ctx.db
      .query("emailVerificationTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!tokenRecord) {
      return {
        success: false,
        message: "Invalid verification token",
      };
    }

    if (tokenRecord.used) {
      return {
        success: false,
        message: "Token already used",
      };
    }

    if (Date.now() > tokenRecord.expiresAt) {
      return {
        success: false,
        message: "Token expired",
      };
    }

    // Mark token as used
    await ctx.db.patch(tokenRecord._id, { used: true });

    // Verify user email
    await ctx.db.patch(tokenRecord.userId, { emailVerified: true });

    return {
      success: true,
      message: "Email verified successfully",
    };
  },
});

// Get current user
export const getCurrentUser = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
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
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    // Return only the fields specified in the validator (exclude _creationTime)
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      membershipTier: user.membershipTier,
      experimentCount: user.experimentCount,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
    };
  },
});

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
    // If user is registered and verified
    if (args.userId) {
      const user = await ctx.db.get(args.userId);
      if (!user || !user.emailVerified) {
        return {
          canUpload: false,
          reason: "User not verified",
          remainingUploads: 0,
        };
      }
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

// Internal function to send verification email
export const sendVerificationEmail = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // In a real application, you would integrate with an email service
    // For now, we'll just log the verification link
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${args.token}`;
    console.log(`Verification email for ${args.email}: ${verificationUrl}`);
    
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    return null;
  },
});
