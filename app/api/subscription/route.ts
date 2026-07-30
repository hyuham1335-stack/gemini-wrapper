import { requireUser } from "@/lib/supabase/require-user";
import { getUserSubscription } from "@/lib/polar/subscription";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  const subscription = await getUserSubscription(supabase, user.id);
  return Response.json({ subscription });
}
