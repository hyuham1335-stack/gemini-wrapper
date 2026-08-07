import { requireUser } from "@/lib/supabase/require-user";
import { errorResponse } from "@/lib/api/error-response";
import { getUserSubscription } from "@/lib/polar/subscription";

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  const subscription = await getUserSubscription(supabase, user.id);
  return Response.json({ subscription });
}
