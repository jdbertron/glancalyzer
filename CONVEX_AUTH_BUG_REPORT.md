# Bug Report: WebSocket Authentication Fails with "No auth provider found matching the given token"

## Summary

After successful sign-in with Convex Auth Password provider, the WebSocket connection fails to authenticate with the error: "No auth provider found matching the given token (no providers configured). Check convex/auth.config.ts."

The token is created successfully and stored in localStorage, but when the WebSocket tries to authenticate, Convex Auth cannot find the provider configuration, even though it's properly defined in `convex/auth.ts`.

## Environment

- **Convex Auth Version**: `@convex-dev/auth@0.0.90`
- **Convex Version**: Latest (using Convex Cloud)
- **Node Version**: (your version)
- **Browser**: (your browser)
- **OS**: Linux

## Steps to Reproduce

1. Configure Convex Auth with Password provider:
   ```typescript
   // convex/auth.ts
   import { convexAuth } from "@convex-dev/auth/server";
   import { Password } from "@convex-dev/auth/providers/Password";
   import { DataModel } from "./_generated/dataModel";

   export const { auth, signIn, signOut, store } = convexAuth({
     providers: [
       Password<DataModel>({
         id: "password",
         profile(params) {
           return {
             email: params.email as string,
             name: params.name as string | undefined,
           };
         },
       }),
     ],
   });
   ```

2. Set up HTTP routes:
   ```typescript
   // convex/http.ts
   import { httpRouter } from "convex/server";
   import { auth } from "./auth";

   const http = httpRouter();
   auth.addHttpRoutes(http);
   export default http;
   ```

3. Configure environment variables:
   - `AUTH_SECRET` is set
   - `JWT_PRIVATE_KEY` is set (optional, for RS256)

4. Sign in using the Password provider:
   ```typescript
   const formData = new FormData();
   formData.set('email', 'user@example.com');
   formData.set('password', 'password123');
   formData.set('flow', 'signIn');
   await signIn('password', formData);
   ```

5. Observe the WebSocket authentication error in the browser console.

## Expected Behavior

After successful sign-in:
- The token should be created and stored
- The WebSocket should authenticate with the new token
- `getAuthUserId(ctx)` should return the authenticated user's ID
- Queries using `getAuthUserId` or `getAuthSessionId` should work correctly

## Actual Behavior

After successful sign-in:
- ✅ The token is created successfully (visible in localStorage)
- ✅ A session is created in the `authSessions` table
- ✅ An account is created in the `authAccounts` table with `provider: "password"`
- ❌ The WebSocket fails to authenticate with error: "No auth provider found matching the given token (no providers configured)"
- ❌ `getAuthUserId(ctx)` returns `null` in all queries
- ❌ `getAuthSessionId(ctx)` returns `null` in all queries
- ❌ `ctx.auth.getUserIdentity()` returns `null`

## Evidence

### WebSocket Error Message
```
{"type":"AuthError","error":"No auth provider found matching the given token (no providers configured). Check convex/auth.config.ts.","baseVersion":0,"authUpdateAttempted":true}
```

### Server Logs
- `auth:store` mutation succeeds with `type: signIn`
- `auth:store` mutation succeeds with `type: refreshSession`
- But all queries return `null` for `getAuthUserId(ctx)`

### Database State
- Sessions exist in `authSessions` table with valid `userId`
- Accounts exist in `authAccounts` table with `provider: "password"`
- Users exist in `users` table

### JWT Token Structure
The JWT token is created successfully with this structure:
```json
{
  "sub": "userId|sessionId",
  "iat": 1764561835,
  "iss": "https://fantastic-penguin-512.convex.site",
  "aud": "convex",
  "exp": 1764565435
}
```

Note: The token does NOT contain a `providerId` field, which might be relevant.

### Manual Verification
When manually querying with a session ID:
- The session exists and has a valid `userId`
- The account exists with `provider: "password"`
- But `auth.getUserId(ctx)` still returns `null`

This suggests the provider configuration isn't being loaded when verifying tokens, even though it's defined in `convex/auth.ts`.

## Workaround

A workaround that bypasses the WebSocket authentication issue:

1. Extract the `sessionId` from the JWT token's `sub` field (format: `userId|sessionId`)
2. Create a query that manually verifies the session:
   ```typescript
   export const getViewerFromSessionId = query({
     args: { sessionId: v.id("authSessions") },
     handler: async (ctx, args) => {
       const session = await ctx.db.get(args.sessionId);
       if (!session) return null;
       const userId = (session as any).userId;
       return await ctx.db.get(userId);
     },
   });
   ```
3. Use this query instead of the normal `viewer` query that relies on `getAuthUserId`

This workaround works because it bypasses the WebSocket authentication and directly looks up the session in the database.

## Root Cause Hypothesis

The issue appears to be that:
1. The provider configuration is defined in `convex/auth.ts`
2. The token is created successfully using this configuration
3. But when the WebSocket tries to authenticate with the token, the provider configuration isn't available/loaded
4. This causes Convex Auth to fail with "no providers configured"

This could be:
- A timing issue where the provider config isn't loaded when WebSocket authenticates
- A deployment issue where the provider config isn't available in the WebSocket authentication context
- A bug in how Convex Auth loads providers during WebSocket token verification

## Additional Information

- The error message references `convex/auth.config.ts` but the file is actually `convex/auth.ts` (might be a red herring)
- This happens on Convex Cloud, not just local dev
- Restarting the Convex dev server doesn't fix it
- Clearing browser storage and signing in again doesn't fix it
- The issue persists across page reloads

## Related Issues

Checked the [Convex Auth GitHub Issues](https://github.com/get-convex/convex-auth/issues) and didn't find any recent issues matching this exact problem.

## Request

Please investigate why the provider configuration isn't available during WebSocket token verification, even though:
- The provider is properly defined in `convex/auth.ts`
- The token is created successfully
- The session and account exist in the database

This is blocking authentication in production applications using Convex Auth with the Password provider.


