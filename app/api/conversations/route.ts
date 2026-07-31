import { requireUser } from "@/lib/supabase/require-user";
import { decrypt, encrypt } from "@/lib/encryption";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title_encrypted, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to list conversations", error);
    return errorResponse("대화 목록을 불러오지 못했습니다.", 500);
  }

  const conversations = data.map(({ id, title_encrypted, created_at }) => ({
    id,
    title: decrypt(title_encrypted),
    created_at,
  }));

  return Response.json({ conversations });
}

export async function POST() {
  const { supabase, user } = await requireUser();
  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: user.id, title_encrypted: encrypt("새 대화") })
    .select("id, title_encrypted, created_at")
    .single();

  if (error) {
    console.error("Failed to create conversation", error);
    return errorResponse("대화를 생성하지 못했습니다.", 500);
  }

  return Response.json(
    { conversation: { id: data.id, title: decrypt(data.title_encrypted), created_at: data.created_at } },
    { status: 201 }
  );
}
