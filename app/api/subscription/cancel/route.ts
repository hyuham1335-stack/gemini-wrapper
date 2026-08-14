import { requireUser } from "@/lib/supabase/require-user";
import { errorResponse, readJsonBody, unauthorizedResponse } from "@/lib/api/error-response";
import { polar } from "@/lib/polar/client";
import { getUserSubscription } from "@/lib/polar/subscription";

interface CancelRequestBody {
  resume?: boolean;
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorizedResponse();

  // An empty body means "cancel" — the resume flow always sends { resume: true }.
  const body = (await readJsonBody<CancelRequestBody>(request)) ?? {};

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
