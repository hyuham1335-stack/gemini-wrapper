import { requireUser } from "@/lib/supabase/require-user";
import { errorResponse, readJsonBody, unauthorizedResponse } from "@/lib/api/error-response";
import { polar } from "@/lib/polar/client";
import { PLAN_PRODUCT_IDS } from "@/lib/polar/plans";
import { getUserSubscription, hasLiveSubscription } from "@/lib/polar/subscription";

interface CheckoutRequestBody {
  plan?: string;
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorizedResponse();

  const body = await readJsonBody<CheckoutRequestBody>(request);
  if (!body) return errorResponse("잘못된 요청 본문입니다.", 400);

  const { plan } = body;
  if (plan !== "pro" && plan !== "unlimited") {
    return errorResponse("올바른 플랜을 선택해주세요.", 400);
  }

  const productId = PLAN_PRODUCT_IDS[plan];
  if (!productId) {
    return errorResponse("서버에 결제 상품이 설정되지 않았습니다.", 500);
  }

  if (!user.email) {
    return errorResponse("결제를 진행하려면 이메일이 필요합니다.", 400);
  }

  const subscription = await getUserSubscription(supabase, user.id);
  if (hasLiveSubscription(subscription)) {
    // past_due included on purpose - a second checkout would bill the user twice
    // and the local row (keyed by user_id) would stop tracking the first one.
    return subscription.status === "past_due"
      ? errorResponse("결제에 실패한 구독이 있습니다. 결제 수단을 먼저 업데이트해주세요.", 400)
      : errorResponse("이미 활성 구독이 있습니다. 플랜 변경을 이용해주세요.", 400);
  }

  const origin = new URL(request.url).origin;

  try {
    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl: `${origin}/pricing/success?checkout_id={CHECKOUT_ID}`,
      // A returning subscriber (previous subscription revoked) already has a Polar
      // customer - reuse it so payment methods and invoice history stay on one
      // customer instead of creating a duplicate keyed only by email.
      ...(subscription.polarCustomerId
        ? { customerId: subscription.polarCustomerId }
        : { customerEmail: user.email }),
      metadata: { userId: user.id },
    });

    return Response.json({ url: checkout.url });
  } catch (error) {
    console.error("Failed to create Polar checkout", error);
    return errorResponse("결제 세션을 생성하지 못했습니다.", 500);
  }
}
