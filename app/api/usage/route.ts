import { requireUser } from "@/lib/supabase/require-user";
import { errorResponse, unauthorizedResponse } from "@/lib/api/error-response";
import { PLAN_LIMITS } from "@/lib/polar/plans";
import { getUserSubscription } from "@/lib/polar/subscription";
import { getUsedCount } from "@/lib/usage";

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorizedResponse();

  const subscription = await getUserSubscription(supabase, user.id);
  const limit = PLAN_LIMITS[subscription.plan];

  let used: number;
  try {
    used = await getUsedCount(supabase, user.id);
  } catch (error) {
    console.error("Failed to load usage", error);
    return errorResponse("사용량을 불러오지 못했습니다.", 500);
  }

  return Response.json({
    plan: subscription.plan,
    used,
    limit,
    remaining: limit === null ? null : Math.max(limit - used, 0),
  });
}
