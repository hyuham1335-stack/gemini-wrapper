import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { planFromProductId } from "@/lib/polar/plans";
import type { Database } from "@/lib/supabase/database.types";

type ServiceClient = SupabaseClient<Database>;

interface ActiveSubscriptionData {
  id: string;
  customerId: string;
  productId: string;
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

async function syncActiveSubscription(supabase: ServiceClient, subscription: ActiveSubscriptionData) {
  const userId = await resolveUserId(supabase, subscription.id, subscription.metadata);
  if (!userId) {
    console.error("Polar webhook: could not resolve user for subscription", subscription.id);
    return;
  }

  const plan = planFromProductId(subscription.productId) ?? "free";
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      polar_customer_id: subscription.customerId,
      polar_subscription_id: subscription.id,
      plan,
      status: "active",
      cancel_at_period_end: subscription.cancelAtPeriodEnd,
      current_period_end: subscription.currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) console.error("Failed to sync subscription", error);
}

async function markPastDue(supabase: ServiceClient, subscriptionId: string) {
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("polar_subscription_id", subscriptionId);
  if (error) console.error("Failed to mark subscription past_due", error);
}

async function markRevoked(supabase: ServiceClient, subscriptionId: string) {
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
  if (error) console.error("Failed to mark subscription revoked", error);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let event: Awaited<ReturnType<typeof validateEvent>>;
  try {
    event = validateEvent(rawBody, headers, process.env.POLAR_WEBHOOK_SECRET ?? "");
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return Response.json({ error: "Invalid signature" }, { status: 403 });
    }
    console.error("Failed to parse Polar webhook event", error);
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const webhookId = request.headers.get("webhook-id");
  if (!webhookId) {
    return Response.json({ error: "Missing webhook-id header" }, { status: 400 });
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
    return Response.json({ error: "Failed to record event" }, { status: 500 });
  }

  switch (event.type) {
    case "subscription.created":
    case "subscription.active":
    case "subscription.updated":
    case "subscription.canceled":
    case "subscription.uncanceled":
      await syncActiveSubscription(supabase, event.data);
      break;
    case "subscription.past_due":
      await markPastDue(supabase, event.data.id);
      break;
    case "subscription.revoked":
      await markRevoked(supabase, event.data.id);
      break;
    default:
      break;
  }

  return Response.json({ ok: true });
}
