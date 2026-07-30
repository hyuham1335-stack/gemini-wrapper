import { requireUser } from "@/lib/supabase/require-user";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/conversations/[id]/messages">
) {
  const { supabase, user } = await requireUser();
  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  const { id } = await ctx.params;

  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to list messages", error);
    return errorResponse("메시지를 불러오지 못했습니다.", 500);
  }

  return Response.json({ messages: data });
}
