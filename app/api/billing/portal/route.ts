import { requireUser } from "@/lib/supabase/require-user";
import { polar } from "@/lib/polar/client";
import { getUserSubscription } from "@/lib/polar/subscription";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST() {
  const { supabase, user } = await requireUser();
  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  const subscription = await getUserSubscription(supabase, user.id);
  if (!subscription.polarCustomerId) {
    return errorResponse("결제 고객 정보가 없습니다.", 400);
  }

  try {
    const session = await polar.customerSessions.create({
      customerId: subscription.polarCustomerId,
    });
    return Response.json({ url: session.customerPortalUrl });
  } catch (error) {
    console.error("Failed to create Polar customer session", error);
    return errorResponse("결제 관리 페이지를 여는 데 실패했습니다.", 500);
  }
}
