import { ApiError, type Content } from "@google/genai";
import { GEMINI_MODEL, gemini } from "@/lib/gemini/client";
import { requireUser } from "@/lib/supabase/require-user";
import { createServiceClient } from "@/lib/supabase/service";
import { PLAN_LIMITS } from "@/lib/polar/plans";
import { currentUsageMonth, getUserSubscription } from "@/lib/polar/subscription";

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
  if (limit !== null) {
    const { data: usage, error: usageError } = await supabase
      .from("usage")
      .select("count")
      .eq("user_id", user.id)
      .eq("month", currentUsageMonth())
      .maybeSingle();

    if (usageError) {
      console.error("Failed to load usage", usageError);
      return errorResponse("사용량을 확인하지 못했습니다.", 500);
    }

    if ((usage?.count ?? 0) >= limit) {
      return Response.json(
        { error: "limit_exceeded", upgrade_url: "/pricing" },
        { status: 429 }
      );
    }
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) {
    console.error("Failed to load conversation", conversationError);
    return errorResponse("대화 정보를 불러오지 못했습니다.", 500);
  }
  if (!conversation) {
    return errorResponse("대화를 찾을 수 없습니다.", 404);
  }

  const { data: history, error: historyError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (historyError) {
    console.error("Failed to load message history", historyError);
    return errorResponse("대화 기록을 불러오지 못했습니다.", 500);
  }

  const isFirstMessage = history.length === 0;

  const { error: insertUserError } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role: "user", content });

  if (insertUserError) {
    console.error("Failed to save user message", insertUserError);
    return errorResponse("메시지를 저장하지 못했습니다.", 500);
  }

  if (isFirstMessage) {
    const { error: titleError } = await supabase
      .from("conversations")
      .update({ title: content.slice(0, 24) })
      .eq("id", conversationId);
    if (titleError) {
      console.error("Failed to update conversation title", titleError);
    }
  }

  const contents: Content[] = [
    ...history.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
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
            .insert({ conversation_id: conversationId, role: "assistant", content: fullText });
          if (insertAssistantError) {
            console.error("Failed to save assistant message", insertAssistantError);
          }

          const { error: usageIncrementError } = await createServiceClient().rpc(
            "increment_usage",
            { p_user_id: user.id }
          );
          if (usageIncrementError) {
            console.error("Failed to increment usage", usageIncrementError);
          }
        }
      } catch (error) {
        console.error("Gemini stream interrupted", error);
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
