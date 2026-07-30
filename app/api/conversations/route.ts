import { requireUser } from "@/lib/supabase/require-user";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to list conversations", error);
    return errorResponse("대화 목록을 불러오지 못했습니다.", 500);
  }

  return Response.json({ conversations: data });
}

export async function POST() {
  const { supabase, user } = await requireUser();
  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: user.id })
    .select("id, title, created_at")
    .single();

  if (error) {
    console.error("Failed to create conversation", error);
    return errorResponse("대화를 생성하지 못했습니다.", 500);
  }

  return Response.json({ conversation: data }, { status: 201 });
}
