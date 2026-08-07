import { requireUser } from "@/lib/supabase/require-user";
import { errorResponse } from "@/lib/api/error-response";
import { PLAN_LIMITS } from "@/lib/polar/plans";
import { currentUsageMonth, getUserSubscription } from "@/lib/polar/subscription";

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  const subscription = await getUserSubscription(supabase, user.id);
  const limit = PLAN_LIMITS[subscription.plan];

  const { data, error } = await supabase
    .from("usage")
    .select("count")
    .eq("user_id", user.id)
    .eq("month", currentUsageMonth())
    .maybeSingle();

  if (error) {
    console.error("Failed to load usage", error);
    return errorResponse("사용량을 불러오지 못했습니다.", 500);
  }

  const used = data?.count ?? 0;

  return Response.json({
    plan: subscription.plan,
    used,
    limit,
    remaining: limit === null ? null : Math.max(limit - used, 0),
  });
}
