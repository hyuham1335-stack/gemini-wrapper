import { requireUser } from "@/lib/supabase/require-user";
import { polar } from "@/lib/polar/client";
import { getUserSubscription } from "@/lib/polar/subscription";

interface CancelRequestBody {
  resume?: boolean;
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  let body: CancelRequestBody = {};
  try {
    body = await request.json();
  } catch {
    // 빈 본문이면 기본값(취소)으로 처리
  }

  const subscription = await getUserSubscription(supabase, user.id);
  if (!subscription.polarSubscriptionId || subscription.status !== "active") {
    return errorResponse("활성 구독이 없습니다.", 400);
  }

  try {
    await polar.subscriptions.update({
      id: subscription.polarSubscriptionId,
      subscriptionUpdate: { cancelAtPeriodEnd: !body.resume },
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to update Polar subscription cancellation", error);
    return errorResponse("구독 취소 처리에 실패했습니다.", 500);
  }
}
