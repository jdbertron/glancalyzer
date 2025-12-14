import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { DataModel } from "./_generated/dataModel";
import { ResendEmailProvider } from "./emailProvider";

// Configure Convex Auth
// Use Password provider with explicit id="password" to ensure it matches signIn('password', ...)
export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password<DataModel>({
      id: "password", // Explicitly set to ensure it matches
      profile(params) {
        return {
          email: params.email as string,
          name: params.name as string | undefined,
        };
      },
      // Configure password reset using OTP via email
      reset: ResendEmailProvider,
    }),
  ],
});
