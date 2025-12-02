import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { getAuthUserId, getAuthSessionId } from "@convex-dev/auth/server";

// Try to manually verify a session by looking it up and checking the account
export const debugManualVerify = query({
  args: {
    sessionId: v.id("authSessions"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    try {
      const session = await ctx.db.get(args.sessionId);
      if (!session) {
        return { error: 'Session not found' };
      }
      
      const sessionUserId = (session as any).userId;
      console.log('[debugManualVerify] Session userId:', sessionUserId);
      
      // Get the account for this user
      const accounts = await ctx.db
        .query("authAccounts")
        .filter((q) => q.eq(q.field("userId"), sessionUserId))
        .collect();
      
      console.log('[debugManualVerify] Accounts found:', accounts.length);
      if (accounts.length === 0) {
        return { error: 'No account found for user' };
      }
      
      const account = accounts[0];
      const provider = (account as any).provider;
      console.log('[debugManualVerify] Account provider:', provider);
      
      // Try to use auth.getUserId with the session context
      // This should work if the provider is configured correctly
      try {
        const authUserId = await auth.getUserId(ctx);
        console.log('[debugManualVerify] auth.getUserId returned:', authUserId);
      } catch (e) {
        console.log('[debugManualVerify] auth.getUserId error:', e);
      }
      
      // Check if we can get the user
      const user = await ctx.db.get(sessionUserId);
      console.log('[debugManualVerify] User found:', !!user);
      
      return {
        session,
        sessionUserId,
        account,
        provider,
        userExists: !!user,
        // The key question: can we verify this session?
        canVerify: sessionUserId !== null && accounts.length > 0,
      };
    } catch (e) {
      console.log('[debugManualVerify] Error:', e);
      return { error: String(e) };
    }
  },
});

// Get the current authenticated user's ID (from Convex Auth)
export const getCurrentUserId = query({
  args: {},
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx) => {
    // Use getAuthUserId from @convex-dev/auth/server (the correct way)
    const userId = await getAuthUserId(ctx);
    const sessionId = await getAuthSessionId(ctx);
    console.log('[getCurrentUserId] getAuthUserId returned:', userId);
    console.log('[getCurrentUserId] getAuthSessionId returned:', sessionId);
    
    if (userId === null) {
      // Debug: Check if standard Convex auth has the identity
      const identity = await ctx.auth.getUserIdentity();
      console.log('[getCurrentUserId] ctx.auth.getUserIdentity() returned:', identity);
      console.log('[getCurrentUserId] No authenticated user found - session may not be established');
      
      // Check if there are any sessions in the database
      try {
        const allSessions = await ctx.db.query("authSessions").collect();
        console.log('[getCurrentUserId] Total sessions in database:', allSessions.length);
        if (allSessions.length > 0) {
          console.log('[getCurrentUserId] Recent sessions:', allSessions.slice(-3).map(s => ({
            _id: s._id,
            userId: (s as any).userId,
            expiresAt: (s as any).expiresAt
          })));
        }
      } catch (e) {
        console.log('[getCurrentUserId] Could not query sessions:', e);
      }
    }
    
    return userId;
  },
});

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
    // Use getAuthUserId from @convex-dev/auth/server (the correct way)
    const userId = await getAuthUserId(ctx);
    console.log('[viewer] getAuthUserId returned:', userId);
    
    if (userId === null) {
      console.log('[viewer] No authenticated user - returning null');
      return null;
    }
    
    const user = await ctx.db.get(userId);
    if (!user) {
      console.log('[viewer] User not found in database for userId:', userId);
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
    const userId = await getAuthUserId(ctx);
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
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    await ctx.db.patch(userId, {
      lastActiveAt: Date.now(),
    });

    return null;
  },
});

// Delete a user account and all associated data
// WARNING: This is irreversible. Use with caution.
// 
// Dependencies handled:
// 1. Experiments - deleted
// 2. Pictures - deleted (along with their storage files)
// 3. Convex Auth sessions - deleted
// 4. Convex Auth accounts - deleted
// 5. User record - deleted
//
// Note: Stripe subscription data is stored in the user record itself,
// so deleting the user will remove that association. You may want to
// cancel the Stripe subscription separately before deleting the account.
export const deleteAccount = mutation({
  args: {
    userId: v.id("users"),
    deletePictures: v.optional(v.boolean()), // If true, delete pictures; if false, set userId to null
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    deletedExperiments: v.number(),
    deletedPictures: v.number(),
    deletedSessions: v.number(),
    deletedAccounts: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return {
        success: false,
        message: "User not found",
        deletedExperiments: 0,
        deletedPictures: 0,
        deletedSessions: 0,
        deletedAccounts: 0,
      };
    }

    let deletedExperiments = 0;
    let deletedPictures = 0;
    let deletedSessions = 0;
    let deletedAccounts = 0;
    const errors: string[] = [];

    // 1. Delete all experiments for this user
    try {
      let experiments;
      try {
        // Try using the index first
        experiments = await ctx.db
          .query("experiments")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect();
      } catch (e) {
        // Fallback: query all and filter
        console.log("Index query failed, falling back to full query:", e);
        const allExperiments = await ctx.db.query("experiments").collect();
        experiments = allExperiments.filter(
          (exp) => exp.userId === args.userId
        );
      }

      console.log(`Found ${experiments.length} experiments for user ${args.userId}`);
      
      for (const experiment of experiments) {
        await ctx.db.delete(experiment._id);
        deletedExperiments++;
      }
    } catch (e) {
      const errorMsg = `Error deleting experiments: ${e}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }

    // 2. Handle pictures
    try {
      let pictures;
      try {
        // Try using the index first
        pictures = await ctx.db
          .query("pictures")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect();
      } catch (e) {
        // Fallback: query all and filter
        console.log("Index query failed, falling back to full query:", e);
        const allPictures = await ctx.db.query("pictures").collect();
        pictures = allPictures.filter(
          (pic) => pic.userId === args.userId
        );
      }

      console.log(`Found ${pictures.length} pictures for user ${args.userId}`);

      const shouldDeletePictures = args.deletePictures !== false; // Default to true

      for (const picture of pictures) {
        if (shouldDeletePictures) {
          // Delete associated experiments first (in case any were missed)
          try {
            const pictureExperiments = await ctx.db
              .query("experiments")
              .withIndex("by_picture", (q) => q.eq("pictureId", picture._id))
              .collect();

            for (const experiment of pictureExperiments) {
              await ctx.db.delete(experiment._id);
              deletedExperiments++;
            }
          } catch (e) {
            console.log(`Error deleting experiments for picture ${picture._id}:`, e);
          }

          // Delete the file from storage
          try {
            await ctx.storage.delete(picture.fileId);
          } catch (e) {
            // File might already be deleted, continue
            console.log(`Could not delete file ${picture.fileId}:`, e);
          }

          // Delete the picture record
          await ctx.db.delete(picture._id);
          deletedPictures++;
        } else {
          // Orphan the picture by setting userId to null
          await ctx.db.patch(picture._id, {
            userId: undefined,
          });
        }
      }
    } catch (e) {
      const errorMsg = `Error deleting pictures: ${e}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }

    // 3. Delete Convex Auth sessions
    // Query all sessions and filter by userId (since we don't know the table structure)
    try {
      const allSessions = await (ctx.db as any).query("sessions").collect();
      const userSessions = allSessions.filter(
        (session: any) => session.userId === args.userId
      );
      
      console.log(`Found ${userSessions.length} sessions for user ${args.userId}`);

      for (const session of userSessions) {
        await ctx.db.delete(session._id);
        deletedSessions++;
      }
    } catch (e) {
      const errorMsg = `Error deleting sessions: ${e}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }

    // 4. Delete Convex Auth accounts
    // Query all accounts and filter by userId
    try {
      const allAccounts = await (ctx.db as any).query("accounts").collect();
      const userAccounts = allAccounts.filter(
        (account: any) => account.userId === args.userId
      );
      
      console.log(`Found ${userAccounts.length} accounts for user ${args.userId}`);

      for (const account of userAccounts) {
        await ctx.db.delete(account._id);
        deletedAccounts++;
      }
    } catch (e) {
      const errorMsg = `Error deleting accounts: ${e}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }

    // 5. Finally, delete the user record
    try {
      await ctx.db.delete(args.userId);
    } catch (e) {
      const errorMsg = `Error deleting user: ${e}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }

    const message = errors.length > 0
      ? `Deleted account with some errors: ${errors.join("; ")}`
      : `Successfully deleted account for user ${args.userId}`;

    return {
      success: errors.length === 0,
      message,
      deletedExperiments,
      deletedPictures,
      deletedSessions,
      deletedAccounts,
    };
  },
});

// Debug query to inspect all sessions and their provider IDs
export const debugSessions = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    try {
      const allSessions = await ctx.db.query("authSessions").collect();
      console.log('[debugSessions] Total sessions:', allSessions.length);
      const sessionsWithDetails = allSessions.map(s => ({
        _id: s._id,
        userId: (s as any).userId,
        tokenIdentifier: (s as any).tokenIdentifier,
        expirationTime: (s as any).expirationTime,
        // Check for provider-related fields
        providerId: (s as any).providerId,
        provider: (s as any).provider,
        // Log all fields to see what's available
        allFields: s,
      }));
      console.log('[debugSessions] Sessions with details:', JSON.stringify(sessionsWithDetails, null, 2));
      return sessionsWithDetails;
    } catch (e) {
      console.log('[debugSessions] Error:', e);
      return [];
    }
  },
});

// Debug query to check authAccounts and see what provider they use
export const debugAuthAccounts = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    try {
      const allAccounts = await ctx.db.query("authAccounts").collect();
      console.log('[debugAuthAccounts] Total accounts:', allAccounts.length);
      const accountsWithDetails = allAccounts.map(a => ({
        _id: a._id,
        userId: (a as any).userId,
        providerId: (a as any).providerId,
        providerAccountId: (a as any).providerAccountId,
        // Log all fields
        allFields: a,
      }));
      console.log('[debugAuthAccounts] Accounts with details:', JSON.stringify(accountsWithDetails, null, 2));
      return accountsWithDetails;
    } catch (e) {
      console.log('[debugAuthAccounts] Error:', e);
      return [];
    }
  },
});

// Debug query to check what the current auth identity contains
export const debugAuthIdentity = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    try {
      // Get the raw identity from Convex
      const identity = await ctx.auth.getUserIdentity();
      console.log('[debugAuthIdentity] ctx.auth.getUserIdentity() returned:', identity);
      
      // Try to get auth user ID
      const userId = await getAuthUserId(ctx);
      console.log('[debugAuthIdentity] getAuthUserId returned:', userId);
      
      // Try to get session ID
      const sessionId = await getAuthSessionId(ctx);
      console.log('[debugAuthIdentity] getAuthSessionId returned:', sessionId);
      
      // Check if we can access the auth object
      try {
        // Try to use auth.getUserId directly
        const authUserId = await auth.getUserId(ctx);
        console.log('[debugAuthIdentity] auth.getUserId returned:', authUserId);
      } catch (e) {
        console.log('[debugAuthIdentity] auth.getUserId error:', e);
      }
      
      // Check what providers are configured
      try {
        // Try to inspect the auth configuration
        const allSessions = await ctx.db.query("authSessions").collect();
        const allAccounts = await ctx.db.query("authAccounts").collect();
        console.log('[debugAuthIdentity] Sessions count:', allSessions.length);
        console.log('[debugAuthIdentity] Accounts count:', allAccounts.length);
        if (allAccounts.length > 0) {
          const account = allAccounts[0];
          console.log('[debugAuthIdentity] First account provider:', (account as any).provider);
        }
      } catch (e) {
        console.log('[debugAuthIdentity] Error checking sessions/accounts:', e);
      }
      
      return {
        identity,
        userId,
        sessionId,
        identityToken: identity?.tokenIdentifier,
        identityProvider: identity?.providerId,
      };
    } catch (e) {
      console.log('[debugAuthIdentity] Error:', e);
      return { error: String(e) };
    }
  },
});

// Debug mutation to test token verification with a specific session ID
export const debugVerifySession = query({
  args: {
    sessionId: v.optional(v.id("authSessions")),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    try {
      // If no sessionId provided, try to get the current one
      let sessionId = args.sessionId;
      if (!sessionId) {
        sessionId = await getAuthSessionId(ctx);
      }
      
      console.log('[debugVerifySession] Testing with sessionId:', sessionId);
      
      if (!sessionId) {
        return { error: 'No session ID available' };
      }
      
      // Get the session from the database
      const session = await ctx.db.get(sessionId);
      console.log('[debugVerifySession] Session from DB:', session);
      
      if (!session) {
        return { error: 'Session not found in database' };
      }
      
      // Try to get the user ID using the session
      const userId = await getAuthUserId(ctx);
      console.log('[debugVerifySession] getAuthUserId returned:', userId);
      
      // Check if the session's userId matches
      const sessionUserId = (session as any).userId;
      console.log('[debugVerifySession] Session userId:', sessionUserId);
      
      // Try to get the account for this user
      if (sessionUserId) {
        const accounts = await ctx.db
          .query("authAccounts")
          .filter((q) => q.eq(q.field("userId"), sessionUserId))
          .collect();
        console.log('[debugVerifySession] Accounts for user:', accounts);
        if (accounts.length > 0) {
          const account = accounts[0];
          console.log('[debugVerifySession] Account provider:', (account as any).provider);
        }
      }
      
      return {
        sessionId,
        session,
        userId,
        sessionUserId,
        match: userId === sessionUserId,
      };
    } catch (e) {
      console.log('[debugVerifySession] Error:', e);
      return { error: String(e) };
    }
  },
});

// WORKAROUND: Manually verify session from sessionId and return user
// This bypasses the WebSocket authentication issue where provider config isn't loaded
// The client can extract the sessionId from the JWT token and pass it here
export const getViewerFromSessionId = query({
  args: {
    sessionId: v.id("authSessions"),
  },
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
  handler: async (ctx, args) => {
    try {
      const session = await ctx.db.get(args.sessionId);
      if (!session) {
        console.log('[getViewerFromSessionId] Session not found:', args.sessionId);
        return null;
      }
      
      const sessionUserId = (session as any).userId;
      if (!sessionUserId) {
        console.log('[getViewerFromSessionId] Session has no userId');
        return null;
      }
      
      // Check if session is expired
      const expirationTime = (session as any).expirationTime;
      if (expirationTime && expirationTime < Date.now()) {
        console.log('[getViewerFromSessionId] Session expired');
        return null;
      }
      
      const user = await ctx.db.get(sessionUserId);
      if (!user) {
        console.log('[getViewerFromSessionId] User not found for userId:', sessionUserId);
        return null;
      }
      
      console.log('[getViewerFromSessionId] Successfully verified session and returning user');
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
        stripeSubscriptionStatus: user.stripeSubscriptionStatus,
        stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd,
      };
    } catch (e) {
      console.log('[getViewerFromSessionId] Error:', e);
      return null;
    }
  },
});

