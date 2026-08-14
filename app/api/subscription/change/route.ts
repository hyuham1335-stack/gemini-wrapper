import { requireUser } from "@/lib/supabase/require-user";
import { errorResponse, readJsonBody, unauthorizedResponse } from "@/lib/api/error-response";
import { polar } from "@/lib/polar/client";
import { PLAN_PRODUCT_IDS } from "@/lib/polar/plans";
import { getUserSubscription } from "@/lib/polar/subscription";

interface ChangeRequestBody {
  plan?: string;
}

export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorizedResponse();

  const body = await readJsonBody<ChangeRequestBody>(request);
  if (!body) return errorResponse("잘못된 요청 본문입니다.", 400);

  const { plan: targetPlan } = body;
  if (targetPlan !== "pro" && targetPlan !== "unlimited") {
    return errorResponse("유료 플랜으로만 변경할 수 있습니다. 해지는 별도 API를 사용해주세요.", 400);
  }

  const subscription = await getUserSubscription(supabase, user.id);
  if (!subscription.polarSubscriptionId || subscription.status !== "active") {
    return errorResponse("활성 구독이 없습니다. 결제를 먼저 진행해주세요.", 400);
  }

  if (subscription.plan === targetPlan) {
    return errorResponse("이미 해당 플랜을 사용 중입니다.", 400);
  }

  const productId = PLAN_PRODUCT_IDS[targetPlan];
  if (!productId) {
    return errorResponse("서버에 결제 상품이 설정되지 않았습니다.", 500);
  }

  try {
    await polar.subscriptions.update({
      id: subscription.polarSubscriptionId,
      subscriptionUpdate: { productId },
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to update Polar subscription plan", error);
    return errorResponse("플랜을 변경하지 못했습니다.", 500);
  }
}
