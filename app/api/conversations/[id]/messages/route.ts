import { requireUser } from "@/lib/supabase/require-user";
import { errorResponse } from "@/lib/api/error-response";
import { decrypt } from "@/lib/encryption";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/conversations/[id]/messages">
) {
  const { supabase, user } = await requireUser();
  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  const { id } = await ctx.params;

  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content_encrypted")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to list messages", error);
    return errorResponse("메시지를 불러오지 못했습니다.", 500);
  }

  const messages = data.map(({ id, role, content_encrypted }) => ({
    id,
    role,
    content: decrypt(content_encrypted),
  }));

  return Response.json({ messages });
}
