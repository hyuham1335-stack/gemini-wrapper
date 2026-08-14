import { requireUser } from "@/lib/supabase/require-user";
import { errorResponse, unauthorizedResponse } from "@/lib/api/error-response";
import { decryptOrFallback } from "@/lib/encryption";

interface SearchResult {
  id: string;
  conversationId: string;
  conversationTitle: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

/** Matches are filtered in memory, so the response is capped (see docs/TRD.md §15). */
const MAX_RESULTS = 50;
/** Guards against pathological queries; longer needles can't match a stored message anyway. */
const MAX_QUERY_LENGTH = 200;

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorizedResponse();

  const query = (new URL(request.url).searchParams.get("q") ?? "")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
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
    conversations.map(({ id, title_encrypted }) => [id, decryptOrFallback(title_encrypted)])
  );

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content_encrypted, created_at")
    .in("conversation_id", [...titleById.keys()])
    .order("created_at", { ascending: false });

  if (messagesError) {
    console.error("Failed to search messages", messagesError);
    return errorResponse("검색에 실패했습니다.", 500);
  }

  // content_encrypted uses a random IV per row, so matching can't be pushed
  // down to SQL — every candidate row must be decrypted and filtered here.
  // Decryption and matching are interleaved so the scan can stop at MAX_RESULTS
  // instead of decrypting every message the user has ever sent.
  const needle = query.toLowerCase();
  const results: SearchResult[] = [];
  for (const message of messages) {
    const content = decryptOrFallback(message.content_encrypted);
    if (!content.toLowerCase().includes(needle)) continue;

    results.push({
      id: message.id,
      conversationId: message.conversation_id,
      conversationTitle: titleById.get(message.conversation_id) ?? "",
      role: message.role as "user" | "assistant",
      content,
      createdAt: message.created_at,
    });
    if (results.length === MAX_RESULTS) break;
  }

  return Response.json({ results });
}
