import { ApiError, type Content } from "@google/genai";
import { GEMINI_MODEL, gemini } from "@/lib/gemini/client";
import { requireUser } from "@/lib/supabase/require-user";
import { createServiceClient } from "@/lib/supabase/service";
import { decrypt, encrypt } from "@/lib/encryption";
import { PLAN_LIMITS } from "@/lib/polar/plans";
import { getUserSubscription } from "@/lib/polar/subscription";

interface ChatRequestBody {
  conversationId?: string;
  content?: string;
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse("잘못된 요청 본문입니다.", 400);
  }

  const { conversationId, content } = body;
  if (!conversationId || !content?.trim()) {
    return errorResponse("올바른 사용자 메시지가 필요합니다.", 400);
  }

  if (!process.env.GOOGLE_API_KEY) {
    return errorResponse("서버에 Gemini API 키가 설정되지 않았습니다.", 500);
  }

  const subscription = await getUserSubscription(supabase, user.id);
  const limit = PLAN_LIMITS[subscription.plan];

  // Reserves the slot atomically (increment + limit check in one statement) so concurrent
  // requests can't all read the same pre-increment count and race past the monthly limit.
  const serviceClient = createServiceClient();
  const { data: reservedCount, error: reserveError } = await serviceClient.rpc(
    "try_increment_usage",
    { p_user_id: user.id, p_limit: limit }
  );

  if (reserveError) {
    console.error("Failed to reserve usage slot", reserveError);
    return errorResponse("사용량을 확인하지 못했습니다.", 500);
  }
  if (reservedCount === null) {
    return Response.json(
      { error: "limit_exceeded", upgrade_url: "/pricing" },
      { status: 429 }
    );
  }

  let usageReserved = true;
  const releaseUsage = async () => {
    if (!usageReserved) return;
    usageReserved = false;
    const { error } = await serviceClient.rpc("release_usage", { p_user_id: user.id });
    if (error) console.error("Failed to release usage reservation", error);
  };

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) {
    console.error("Failed to load conversation", conversationError);
    await releaseUsage();
    return errorResponse("대화 정보를 불러오지 못했습니다.", 500);
  }
  if (!conversation) {
    await releaseUsage();
    return errorResponse("대화를 찾을 수 없습니다.", 404);
  }

  const { data: history, error: historyError } = await supabase
    .from("messages")
    .select("role, content_encrypted")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (historyError) {
    console.error("Failed to load message history", historyError);
    await releaseUsage();
    return errorResponse("대화 기록을 불러오지 못했습니다.", 500);
  }

  const isFirstMessage = history.length === 0;

  const { error: insertUserError } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role: "user", content_encrypted: encrypt(content) });

  if (insertUserError) {
    console.error("Failed to save user message", insertUserError);
    await releaseUsage();
    return errorResponse("메시지를 저장하지 못했습니다.", 500);
  }

  if (isFirstMessage) {
    const { error: titleError } = await supabase
      .from("conversations")
      .update({ title_encrypted: encrypt(content.slice(0, 24)) })
      .eq("id", conversationId);
    if (titleError) {
      console.error("Failed to update conversation title", titleError);
    }
  }

  const contents: Content[] = [
    ...history.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: decrypt(message.content_encrypted) }],
    })),
    { role: "user", parts: [{ text: content }] },
  ];

  let stream: AsyncGenerator<{ text?: string }>;
  try {
    stream = await gemini.models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
    });
  } catch (error) {
    await releaseUsage();
    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }
    console.error("Gemini generateContentStream failed", error);
    return errorResponse("Gemini 응답 생성에 실패했습니다.", 500);
  }

  const encoder = new TextEncoder();
  let fullText = "";
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.text) {
            fullText += chunk.text;
            controller.enqueue(encoder.encode(chunk.text));
          }
        }
        controller.close();

        if (fullText) {
          const { error: insertAssistantError } = await supabase
            .from("messages")
            .insert({ conversation_id: conversationId, role: "assistant", content_encrypted: encrypt(fullText) });
          if (insertAssistantError) {
            console.error("Failed to save assistant message", insertAssistantError);
          }
        } else {
          // No billable output was produced (e.g. stream closed empty); give the slot back.
          await releaseUsage();
        }
      } catch (error) {
        console.error("Gemini stream interrupted", error);
        await releaseUsage();
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
