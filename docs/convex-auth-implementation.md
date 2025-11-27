# Convex Auth Implementation Chat Log

This document records the implementation of Convex Auth with password authentication for the Glancalyzer project.

---

## Initial Discussion: Understanding the Existing Auth System

**User:** Ok, so this web site has a set-up for membership. Can I assume there is a way for people to have a password to their profile? Surely we can't have someone peep at someone else's pictures, so people should first authenticate, right?

**Assistant:** Based on my analysis of the codebase, I can give you a clear picture of the authentication system:

### Current Authentication Model: **Passwordless / Magic Link**

This application uses **email-based passwordless authentication** - it does **NOT** have traditional password authentication. Here's how it works:

#### Registration & Login Flow:
1. **Registration**: User enters email → receives a verification email with a magic link token
2. **Verification**: User clicks the link → email is marked as verified
3. **Login**: Verified users enter their email → they're logged in (no password needed)

#### How User Data is Protected:

Pictures are protected by **userId ownership** - the `getUserPictures` query only returns pictures belonging to the authenticated user.

#### Security Considerations:

**The current implementation has some limitations:**

1. **Client-side authentication**: The `userId` is stored in `localStorage` and sent with requests. This relies on trusting the client.
2. **No password protection**: Anyone who knows your email can trigger a verification email, but they'd need access to your email inbox to complete login.
3. **No session tokens/JWT**: There's no server-side session validation beyond checking if the userId exists.

---

## Understanding the userId

**User:** The userId is hopefully not just their email, right? Otherwise they can't log-in from a different device, or if they clear their browser's cache.

**Assistant:** Good question! **The `userId` is NOT the email** - it's a Convex-generated document ID (like `j57x8kj3n4m2...`).

### How Login Works Across Devices:

1. **User enters their email** on any device
2. **Backend looks up user by email** (using the `by_email` index)
3. **Returns the permanent `userId`** (Convex document ID)
4. **Client stores it in localStorage**

So if a user:
- **Clears their cache**: They just enter their email again → system finds their account → returns their userId
- **Uses a different device**: Same thing - enter email → get their userId back

The email is the **lookup key**, and the Convex document ID (`user._id`) is the **persistent identifier** that ties together all their pictures and experiments.

---

## Security Vulnerability Identified

**User:** Ok, but then that means I can enter someone else's email and see their pictures.

**Assistant:** You're absolutely right - that's a **significant security vulnerability** in the current implementation! 🚨

The `loginUser` mutation for **already-verified users** does NO authentication:
- No password check
- No magic link sent
- No email verification required
- Just returns the userId immediately

**The security model is broken.** The email verification only happens once during registration. After that, anyone who knows your email can log in as you.

### Options to Fix This:

1. **Always require magic link** (true passwordless) - Every login sends a verification email
2. **Add traditional passwords** - Store hashed passwords, require password on every login
3. **Use a proper auth provider** (recommended) - Clerk, Auth0, or Convex Auth

---

## Choosing an Auth Solution

**User:** #1 is not passwordless. You must have a password to get into your email for the link. Right now I'm leaning toward a traditional model. But tell me more about #3. Are you talking about OAuth here? Is this log-in with facebook or google sort of thing?

**Assistant:** Great clarification on the "passwordless" terminology - you're right, the password just shifts to your email provider!

### Option 3: Auth Providers Explained

It's **not just OAuth/social login** - auth providers are full authentication services that can support **multiple methods**:

| Method | Description |
|--------|-------------|
| **Email/Password** | Traditional login with secure password hashing |
| **OAuth/Social** | Login with Google, GitHub, Facebook, etc. |
| **Magic Links** | Email-based links (what you have now, but done properly) |
| **SMS/Phone** | Text message verification codes |
| **Passkeys** | Biometric/hardware key authentication |

### Popular Options:

1. **Clerk** - Very popular for React apps, beautiful pre-built UI, paid service
2. **Auth0** - Enterprise-grade, very flexible, can be complex
3. **Convex Auth** - Built specifically for Convex projects, native integration, free

### Why Use a Provider vs. DIY?

Building auth yourself means handling:
- Password hashing (bcrypt/argon2)
- Secure session tokens (JWT)
- Token expiration/refresh
- CSRF protection
- Rate limiting for brute force
- Password reset flows
- Email delivery

Auth providers handle all this **and** have security teams constantly patching vulnerabilities.

---

## Decision: Convex Auth

**User:** Ok, I don't want to build my own if I can avoid it. It sounds like that's what options 2/traditional would entail. I don't know Auth0 and I don't want to pay for Clerk, so it sounds like convex auth is the way to go. Let's go with the Convex Auth.

---

## Implementation

### Step 1: Install Packages

```bash
npm install @convex-dev/auth @auth/core
```

### Step 2: Update Schema (`convex/schema.ts`)

Added Convex Auth tables and updated users table with backward compatibility:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Include Convex Auth tables
  ...authTables,

  // Users table with auth fields + app-specific fields
  users: defineTable({
    // Auth fields (managed by Convex Auth)
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    emailVerified: v.optional(v.boolean()), // Legacy field for backward compatibility
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    // App-specific fields
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
  }).index("by_email", ["email"]),
  
  // ... other tables
});
```

### Step 3: Create Auth Configuration (`convex/auth.ts`)

```typescript
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { DataModel } from "./_generated/dataModel";

const CustomPassword = Password<DataModel>({
  profile(params) {
    return {
      email: params.email as string,
      name: params.name as string | undefined,
    };
  },
});

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [CustomPassword],
});
```

### Step 4: Create HTTP Routes (`convex/http.ts`)

```typescript
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
```

### Step 5: Update Frontend Provider (`src/main.tsx`)

```typescript
import { ConvexReactClient } from 'convex/react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <App />
        <Toaster position="top-right" />
      </BrowserRouter>
    </ConvexAuthProvider>
  </React.StrictMode>,
)
```

### Step 6: Update Auth Hook (`src/hooks/useAuth.ts`)

```typescript
import { useConvexAuth, useQuery } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { api } from '../../convex/_generated/api'
import toast from 'react-hot-toast'

export function useAuth() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signIn, signOut } = useAuthActions()
  const user = useQuery(api.users.viewer)

  const login = async (email: string, password: string) => {
    try {
      await signIn('password', { email, password, flow: 'signIn' })
      toast.success('Login successful')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      toast.error(message)
      throw error
    }
  }

  const register = async (email: string, password: string, name?: string) => {
    try {
      const params: Record<string, string> = { email, password, flow: 'signUp' }
      if (name) params.name = name
      await signIn('password', params)
      toast.success('Registration successful')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed'
      toast.error(message)
      throw error
    }
  }

  const logout = async () => {
    try {
      await signOut()
      toast.success('Logged out successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed'
      toast.error(message)
    }
  }

  return {
    user,
    userId: user?._id ?? null,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
  }
}
```

### Step 7: Create User Viewer Query (`convex/users.ts`)

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

export const viewer = query({
  args: {},
  returns: v.union(v.object({...}), v.null()),
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (userId === null) return null;
    
    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      // ... other fields
    };
  },
});
```

### Step 8: Set Environment Variables

```bash
# Generate a secret for JWT signing
openssl rand -base64 32

# Set environment variables in Convex
npx convex env set AUTH_SECRET "<REDACTED>"
npx convex env set SITE_URL "http://localhost:5173"
```

### Step 9: Update Login/Register Pages

Updated both pages to include password fields with show/hide toggle and proper validation.

---

## Understanding AUTH_SECRET

**User:** Where does the AUTH_SECRET come from?

**Assistant:** The `AUTH_SECRET` was generated using OpenSSL:

```bash
openssl rand -base64 32
```

Then set in Convex environment:

```bash
npx convex env set AUTH_SECRET "<your-secret-here>"
```

### What is it used for?

`AUTH_SECRET` is used by Convex Auth to:
1. **Sign JWT tokens** - When a user logs in, Convex Auth creates a signed JWT that proves their identity
2. **Verify JWT tokens** - On subsequent requests, the signature is verified to ensure the token wasn't tampered with

### Important Notes:

- **Keep it secret!** - Anyone with this key could forge authentication tokens
- **It's stored in Convex** - Not in your codebase (which is good for security)
- **Don't lose it** - If you change it, all existing user sessions will be invalidated

---

## JWT Verification Architecture

**User:** But the client must use it to verify the JWT signature somehow, right?

**Assistant:** Great question! The answer is: **the client doesn't verify the JWT signature** - only the server does.

### How it actually works:

```
┌─────────┐                              ┌─────────────┐
│ Browser │                              │   Convex    │
│ (Client)│                              │  (Server)   │
└────┬────┘                              └──────┬──────┘
     │                                          │
     │  1. Login (email + password)             │
     │ ────────────────────────────────────────>│
     │                                          │  ← Verifies password
     │                                          │  ← Signs JWT with AUTH_SECRET
     │  2. Returns signed JWT                   │
     │ <────────────────────────────────────────│
     │                                          │
     │  ← Stores JWT (cookie/memory)            │
     │                                          │
     │  3. API request + JWT                    │
     │ ────────────────────────────────────────>│
     │                                          │  ← Verifies JWT signature
     │                                          │    using AUTH_SECRET
     │  4. Response (if valid)                  │
     │ <────────────────────────────────────────│
```

### Key points:

1. **AUTH_SECRET never leaves the server** - It's only in Convex's environment
2. **Client just stores and sends the token** - It doesn't need to verify it
3. **Server verifies on every request** - Using the secret only it knows

The client trusts the server. The JWT is essentially a signed "pass" that says "this user is authenticated" - the server checks the signature to make sure it was the one who issued that pass (and that nobody tampered with it).

This is standard JWT architecture - the secret is **asymmetric** in its use: one side signs, the same side verifies. The client is just a messenger.

---

## Summary of Changes

### Files Created:
- `convex/auth.ts` - Convex Auth configuration
- `convex/http.ts` - HTTP routes for auth
- `convex/users.ts` - User viewer query
- `convex/authUtils.ts` - Utility functions

### Files Modified:
- `convex/schema.ts` - Added auth tables
- `src/main.tsx` - ConvexAuthProvider
- `src/hooks/useAuth.ts` - New auth implementation
- `src/pages/Login.tsx` - Password field added
- `src/pages/Register.tsx` - Password fields added
- `src/pages/VerifyEmail.tsx` - Simplified (no longer needed)
- `src/pages/Profile.tsx` - Updated for optional fields
- `src/pages/Upload.tsx` - Updated API reference
- `src/components/Navbar.tsx` - Proper logout

### How the New Auth Works:

**Registration:**
- User enters email, password, optional name
- Password must be at least 8 characters
- Account is created immediately
- User is logged in automatically

**Login:**
- User enters email + password
- Convex Auth verifies credentials securely
- JWT token managed by Convex Auth

**Security:**
- Passwords are hashed using bcrypt
- Sessions are managed with secure JWTs
- No more client-side userId in localStorage
- Users can only see their own pictures (verified server-side)

---

*Document generated: November 27, 2025*

