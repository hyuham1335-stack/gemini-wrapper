import { requireUser } from "@/lib/supabase/require-user";
import { unauthorizedResponse } from "@/lib/api/error-response";
import { getUserSubscription } from "@/lib/polar/subscription";

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorizedResponse();

  const subscription = await getUserSubscription(supabase, user.id);
  return Response.json({ subscription });
}
