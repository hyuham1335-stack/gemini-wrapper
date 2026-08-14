import { requireUser } from "@/lib/supabase/require-user";
import { errorResponse, unauthorizedResponse } from "@/lib/api/error-response";
import { decryptOrFallback } from "@/lib/encryption";

const UNREADABLE_MESSAGE = "(이 메시지를 불러오지 못했습니다.)";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/conversations/[id]/messages">
) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorizedResponse();

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

  // One unreadable row degrades to a placeholder instead of failing the transcript.
  const messages = data.map(({ id, role, content_encrypted }) => ({
    id,
    role,
    content: decryptOrFallback(content_encrypted, UNREADABLE_MESSAGE),
  }));

  return Response.json({ messages });
}
