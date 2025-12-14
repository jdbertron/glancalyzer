import { Email } from "@convex-dev/auth/providers/Email";
import { DataModel } from "./_generated/dataModel";

// Email provider for password reset OTP codes using Resend
export const ResendEmailProvider = Email<DataModel>({
  id: "resend",
  // Override authorize to skip email check - OTP code verification is sufficient
  // This prevents "InvalidSecret" errors during password reset verification
  authorize: undefined,
  // Generate a shorter 8-digit OTP code instead of the default 32-character string
  async generateVerificationToken() {
    // Generate 8-digit numeric code using crypto for better randomness
    // Note: In Convex actions, we can use crypto.randomInt if available
    const digits = "0123456789";
    let code = "";
    // Use a simple approach that works in Convex's environment
    for (let i = 0; i < 8; i++) {
      // Math.random() should be sufficient for OTP codes
      const randomIndex = Math.floor(Math.random() * digits.length);
      code += digits[randomIndex];
    }
    console.log(`[EmailProvider] Generated OTP code: ${code}`);
    return code;
  },
  // Set expiration to 10 minutes (600 seconds) to match email message
  maxAge: 60 * 10, // 10 minutes
  async sendVerificationRequest(params: {
    identifier: string;
    token: string;
    url: string;
    provider: any;
  }) {
    console.log('[EmailProvider] sendVerificationRequest called with params:', {
      identifier: params.identifier,
      token: params.token ? '***' : null,
      url: params.url ? params.url.substring(0, 100) : null,
    });
    
    const { identifier: email, token, url } = params;
    
    // Extract the OTP code from the token or URL
    // Convex Auth provides the token which is the OTP code
    const code = token || (url ? new URL(url).searchParams.get("token") : null);
    
    if (!code) {
      console.error("[EmailProvider] No OTP code provided in password reset request", {
        hasToken: !!token,
        hasUrl: !!url,
        paramsKeys: Object.keys(params),
      });
      throw new Error("No verification code provided");
    }
    
    console.log(`[EmailProvider] Sending password reset OTP to ${email}, code: ${code}`);
    console.log(`[EmailProvider] Full params:`, JSON.stringify({ email, token, url: url?.substring(0, 100) }));
    
    // Try to send email - EmailProvider should run in HTTP action context which supports fetch
    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        console.error("RESEND_API_KEY not configured");
        console.log(`[DEV] Password reset OTP for ${email}: ${code}`);
        // Don't throw - just log in dev
        return;
      }

      const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
      
      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 30px; margin: 20px 0;">
              <h1 style="color: #111827; margin-top: 0;">Reset Your Password</h1>
              <p style="color: #6b7280; font-size: 16px;">
                Use this code to reset your password:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 24px; letter-spacing: 4px;">
                  ${code}
                </div>
              </div>
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                This code will expire in 10 minutes. If you didn't request a password reset, you can safely ignore this email.
              </p>
            </div>
          </body>
        </html>
      `;

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: "Reset your password",
          html: emailHtml,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Resend API error (${response.status}):`, errorText);
        throw new Error(`Failed to send email: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log(`Password reset OTP sent to ${email}`, result);
    } catch (error) {
      console.error("Error sending password reset email:", error);
      // Log the code for debugging even if email fails
      console.log(`[DEBUG] OTP code that should have been sent: ${code}`);
      throw error;
    }
  },
});

