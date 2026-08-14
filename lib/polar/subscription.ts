import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Plan } from "./plans";

export interface UserSubscription {
  plan: Plan;
  status: "active" | "past_due" | "revoked";
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  polarCustomerId: string | null;
  polarSubscriptionId: string | null;
}

/**
 * Fallback for users whose `subscriptions` row does not exist yet (the
 * `on_auth_user_created_subscription` trigger normally creates it at signup).
 */
const DEFAULT_FREE_SUBSCRIPTION: UserSubscription = {
  plan: "free",
  status: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  polarCustomerId: null,
  polarSubscriptionId: null,
};

export async function getUserSubscription(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserSubscription> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "plan, status, cancel_at_period_end, current_period_end, polar_customer_id, polar_subscription_id"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Falling back to free is the safe direction: it can never over-grant quota.
    console.error("Failed to load subscription, falling back to free", error);
    return DEFAULT_FREE_SUBSCRIPTION;
  }
  if (!data) return DEFAULT_FREE_SUBSCRIPTION;

  return {
    plan: data.plan as Plan,
    status: data.status as UserSubscription["status"],
    cancelAtPeriodEnd: data.cancel_at_period_end,
    currentPeriodEnd: data.current_period_end,
    polarCustomerId: data.polar_customer_id,
    polarSubscriptionId: data.polar_subscription_id,
  };
}
