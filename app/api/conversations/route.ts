import { requireUser } from "@/lib/supabase/require-user";
import { errorResponse, unauthorizedResponse } from "@/lib/api/error-response";
import { decryptOrFallback, encrypt } from "@/lib/encryption";

const UNTITLED_CONVERSATION = "새 대화";

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorizedResponse();

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title_encrypted, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to list conversations", error);
    return errorResponse("대화 목록을 불러오지 못했습니다.", 500);
  }

  // A single undecryptable title must not blank out the whole sidebar.
  const conversations = data.map(({ id, title_encrypted, created_at }) => ({
    id,
    title: decryptOrFallback(title_encrypted, UNTITLED_CONVERSATION),
    created_at,
  }));

  return Response.json({ conversations });
}

export async function POST() {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorizedResponse();

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: user.id, title_encrypted: encrypt(UNTITLED_CONVERSATION) })
    .select("id, title_encrypted, created_at")
    .single();

  if (error) {
    console.error("Failed to create conversation", error);
    return errorResponse("대화를 생성하지 못했습니다.", 500);
  }

  return Response.json(
    {
      conversation: {
        id: data.id,
        title: decryptOrFallback(data.title_encrypted, UNTITLED_CONVERSATION),
        created_at: data.created_at,
      },
    },
    { status: 201 }
  );
}
