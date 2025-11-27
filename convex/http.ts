import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import Stripe from "stripe";

const http = httpRouter();

// Convex Auth routes
auth.addHttpRoutes(http);

// Stripe webhook endpoint
// Configure this URL in Stripe Dashboard: https://your-convex-url.convex.site/stripe/webhook
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // Get the webhook secret from environment variables
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Get the Stripe signature header
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("No stripe-signature header");
      return new Response("No signature", { status: 400 });
    }

    // Get the raw body
    const body = await req.text();

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-11-17.clover",
    });

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Webhook signature verification failed: ${message}`);
      return new Response(`Webhook Error: ${message}`, { status: 400 });
    }

    console.log(`Received Stripe webhook: ${event.type}`);

    // Handle the event
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          // Payment successful, subscription created
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(`Checkout completed for session: ${session.id}`);
          
          // The subscription details will come through subscription events
          // We just log this for now
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          // Subscription was created or updated
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = typeof subscription.customer === "string" 
            ? subscription.customer 
            : subscription.customer.id;
          
          // Get the first subscription item's price
          const priceId = subscription.items.data[0]?.price.id ?? "";
          
          await ctx.runMutation(internal.stripeHelpers.updateSubscription, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            stripeSubscriptionStatus: subscription.status as "active" | "canceled" | "incomplete" | "incomplete_expired" | "past_due" | "trialing" | "unpaid" | "paused",
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: subscription.current_period_end * 1000, // Convert to ms
          });
          
          console.log(`Updated subscription ${subscription.id} status: ${subscription.status}`);
          break;
        }

        case "customer.subscription.deleted": {
          // Subscription was cancelled/deleted
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = typeof subscription.customer === "string" 
            ? subscription.customer 
            : subscription.customer.id;
          
          await ctx.runMutation(internal.stripeHelpers.cancelSubscription, {
            stripeCustomerId: customerId,
          });
          
          console.log(`Cancelled subscription for customer: ${customerId}`);
          break;
        }

        case "invoice.payment_failed": {
          // Payment failed - you might want to notify the user
          const invoice = event.data.object as Stripe.Invoice;
          console.error(`Payment failed for invoice: ${invoice.id}`);
          // TODO: Optionally send email notification to user
          break;
        }

        default:
          // Log unhandled event types
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }

      return new Response("OK", { status: 200 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Error handling webhook: ${message}`);
      return new Response(`Webhook handler error: ${message}`, { status: 500 });
    }
  }),
});

export default http;

