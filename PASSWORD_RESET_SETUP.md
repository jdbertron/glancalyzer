# Password Reset Email Setup with Resend

## Overview

The password reset flow uses Convex Auth's built-in OTP (One-Time Password) system with Resend for sending password reset codes. Users receive an 8-digit numeric code via email that expires in 10 minutes.

## Step 1: Set Environment Variables in Convex Dashboard

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project (dev or production)
3. Navigate to **Settings** → **Environment Variables**
4. Add the following variables:

### Required Variables

- **`RESEND_API_KEY`**: Your Resend API key
  - Value: `re_XPrVfaR4_QJFMywBzYgkPXF3HR1hmjU9G`
  - ⚠️ **Security Note**: Keep this secret! Never commit it to git.

- **`FRONTEND_URL`**: Your frontend URL
  - **Development**: `http://localhost:5173`
  - **Production**: Your production domain (e.g., `https://yourdomain.com`)

### Optional Variables

- **`RESEND_FROM_EMAIL`**: The "from" email address for password reset emails
  - Default: `onboarding@resend.dev` (works for testing)
  - **For production**: You'll need to verify your domain with Resend and use an email like `noreply@yourdomain.com`

## Step 2: Verify Your Domain (Production Only)

For production use, you should:

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Add and verify your domain
3. Update `RESEND_FROM_EMAIL` to use your verified domain (e.g., `noreply@yourdomain.com`)

## Step 3: Deploy

After setting the environment variables:

```bash
# For development
npx convex dev

# For production
npx convex deploy
```

## Testing

1. Go to the login page
2. Click "Forgot your password?"
3. Enter your email address and click "Send reset code"
4. You'll be redirected to the Reset Password page
5. Check your email for the 8-digit OTP code
6. Enter the code, your new password, and submit

## Troubleshooting

### Emails not sending

1. **Check Convex logs**: Look for errors in the Convex Dashboard → Logs
2. **Verify API key**: Make sure `RESEND_API_KEY` is set correctly
3. **Check Resend dashboard**: Verify your API key is active and you haven't exceeded rate limits

### Development fallback

If `RESEND_API_KEY` is not set, the system will:
- Log the OTP code to the Convex logs (check the dashboard)
- Still return success (for security - doesn't reveal if email exists)
- You can find the code in the Convex Dashboard → Logs

### Email domain issues

- For testing: `onboarding@resend.dev` works without verification
- For production: You must verify your domain in Resend

## Security Notes

- ✅ OTP codes expire after 10 minutes
- ✅ Codes can only be used once (deleted after verification)
- ✅ Codes are hashed before storage in the database
- ✅ Rate limiting prevents code spam
- ✅ System doesn't reveal if an email exists (shows success message regardless)
- ✅ Uses Convex Auth's built-in OTP verification system

## Resend Pricing

Resend offers:
- **Free tier**: 3,000 emails/month
- **Paid plans**: Start at $20/month for 50,000 emails

Check [Resend Pricing](https://resend.com/pricing) for current rates.

