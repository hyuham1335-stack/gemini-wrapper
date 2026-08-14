import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { planFromProductId } from "@/lib/polar/plans";
import { errorResponse } from "@/lib/api/error-response";
import type { Database } from "@/lib/supabase/database.types";

type ServiceClient = SupabaseClient<Database>;

/** The only statuses the `subscriptions` table stores. */
type LocalStatus = "active" | "past_due" | "revoked";

/**
 * Maps a Polar subscription status onto the status column.
 *
 * `canceled` stays `active` on purpose: in Polar a canceled subscription keeps
 * serving until the period ends, and the separate `subscription.revoked` event
 * is what actually ends access. Treating it as revoked here would cut a paying
 * user off the moment they schedule a cancellation.
 */
function localStatusFrom(polarStatus: string): LocalStatus {
  if (polarStatus === "past_due" || polarStatus === "unpaid") return "past_due";
  return "active";
}

interface ActiveSubscriptionData {
  id: string;
  customerId: string;
  productId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date;
  metadata: Record<string, unknown>;
}

async function resolveUserId(
  supabase: ServiceClient,
  subscriptionId: string,
  metadata: Record<string, unknown>
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("polar_subscription_id", subscriptionId)
    .maybeSingle();
  if (existing) return existing.user_id;

  const userId = metadata.userId;
  return typeof userId === "string" ? userId : null;
}

/**
 * Handlers return `false` only for failures a retry could fix (a write that
 * didn't land). Cases that would fail identically on every retry — unknown user,
 * unrecognized product, payment not settled yet — return `true` so Polar stops
 * redelivering an event we will never be able to apply.
 */
async function syncActiveSubscription(
  supabase: ServiceClient,
  subscription: ActiveSubscriptionData
): Promise<boolean> {
  const userId = await resolveUserId(supabase, subscription.id, subscription.metadata);
  if (!userId) {
    console.error("Polar webhook: could not resolve user for subscription", subscription.id);
    return true;
  }

  // Payment hasn't cleared yet - don't grant the paid plan prematurely.
  // A later subscription.active/updated event will re-sync once it does.
  if (subscription.status === "incomplete" || subscription.status === "incomplete_expired") {
    console.error("Polar webhook: subscription payment not complete, skipping plan sync", {
      subscriptionId: subscription.id,
      status: subscription.status,
    });
    return true;
  }

  const plan = planFromProductId(subscription.productId);
  if (!plan) {
    console.error("Polar webhook: unrecognized product id, skipping plan sync", {
      subscriptionId: subscription.id,
      productId: subscription.productId,
    });
    return true;
  }

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      polar_customer_id: subscription.customerId,
      polar_subscription_id: subscription.id,
      plan,
      // Don't blanket-write "active": a subscription.updated event can arrive while
      // the subscription is past_due, and forcing it back to active would silently
      // restore paid quota for an unpaid subscription.
      status: localStatusFrom(subscription.status),
      cancel_at_period_end: subscription.cancelAtPeriodEnd,
      current_period_end: subscription.currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Failed to sync subscription", error);
    return false;
  }
  return true;
}

async function markPastDue(supabase: ServiceClient, subscriptionId: string): Promise<boolean> {
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("polar_subscription_id", subscriptionId);
  if (error) {
    console.error("Failed to mark subscription past_due", error);
    return false;
  }
  return true;
}

async function markRevoked(supabase: ServiceClient, subscriptionId: string): Promise<boolean> {
  const { error } = await supabase
    .from("subscriptions")
    .update({
      plan: "free",
      status: "revoked",
      cancel_at_period_end: false,
      current_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq("polar_subscription_id", subscriptionId);
  if (error) {
    console.error("Failed to mark subscription revoked", error);
    return false;
  }
  return true;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Polar webhook: POLAR_WEBHOOK_SECRET is not configured on this deployment");
    return errorResponse("Webhook not configured", 500);
  }

  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let event: Awaited<ReturnType<typeof validateEvent>>;
  try {
    event = validateEvent(rawBody, headers, webhookSecret);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return errorResponse("Invalid signature", 403);
    }
    console.error("Failed to parse Polar webhook event", error);
    return errorResponse("Invalid payload", 400);
  }

  const webhookId = request.headers.get("webhook-id");
  if (!webhookId) {
    return errorResponse("Missing webhook-id header", 400);
  }

  const supabase = createServiceClient();

  // Idempotency: insert first, unique-violation means we've already processed this delivery.
  const { error: ledgerError } = await supabase
    .from("webhook_events")
    .insert({ id: webhookId, event_type: event.type, payload: JSON.parse(JSON.stringify(event)) });

  if (ledgerError) {
    if (ledgerError.code === "23505") {
      return Response.json({ ok: true });
    }
    console.error("Failed to record webhook event", ledgerError);
    return errorResponse("Failed to record event", 500);
  }

  let handled: boolean;
  try {
    switch (event.type) {
      case "subscription.created":
      case "subscription.active":
      case "subscription.updated":
      case "subscription.canceled":
      case "subscription.uncanceled":
        handled = await syncActiveSubscription(supabase, event.data);
        break;
      case "subscription.past_due":
        handled = await markPastDue(supabase, event.data.id);
        break;
      case "subscription.revoked":
        handled = await markRevoked(supabase, event.data.id);
        break;
      default:
        handled = true;
        break;
    }
  } catch (error) {
    console.error("Polar webhook handler threw", { eventType: event.type, error });
    handled = false;
  }

  if (!handled) {
    // The ledger row was written before processing, so leaving it in place would
    // make Polar's retry look like a duplicate and drop the event for good.
    // Remove it and answer 5xx so the retry is actually processed.
    const { error: rollbackError } = await supabase
      .from("webhook_events")
      .delete()
      .eq("id", webhookId);
    if (rollbackError) {
      console.error("Failed to roll back webhook ledger entry", rollbackError);
    }
    return errorResponse("Failed to process event", 500);
  }

  return Response.json({ ok: true });
}
