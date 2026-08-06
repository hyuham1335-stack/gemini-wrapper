import { requireUser } from "@/lib/supabase/require-user";
import { decrypt } from "@/lib/encryption";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return Response.json({ results: [] });

  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("id, title_encrypted");

  if (conversationsError) {
    console.error("Failed to load conversations for search", conversationsError);
    return errorResponse("검색에 실패했습니다.", 500);
  }

  if (conversations.length === 0) {
    return Response.json({ results: [] });
  }

  const titleById = new Map(
    conversations.map(({ id, title_encrypted }) => [id, decrypt(title_encrypted)])
  );

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content_encrypted, created_at")
    .in(
      "conversation_id",
      conversations.map((conversation) => conversation.id)
    )
    .order("created_at", { ascending: false });

  if (messagesError) {
    console.error("Failed to search messages", messagesError);
    return errorResponse("검색에 실패했습니다.", 500);
  }

  // content_encrypted uses a random IV per row, so matching can't be pushed
  // down to SQL — every candidate row must be decrypted and filtered here.
  const needle = query.toLowerCase();
  const results = messages
    .map((message) => ({
      id: message.id,
      conversationId: message.conversation_id,
      conversationTitle: titleById.get(message.conversation_id) ?? "",
      role: message.role as "user" | "assistant",
      content: decrypt(message.content_encrypted),
      createdAt: message.created_at,
    }))
    .filter((message) => message.content.toLowerCase().includes(needle))
    .slice(0, 50);

  return Response.json({ results });
}
