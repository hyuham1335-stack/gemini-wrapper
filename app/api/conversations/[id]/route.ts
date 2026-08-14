import { requireUser } from "@/lib/supabase/require-user";
import { errorResponse, unauthorizedResponse } from "@/lib/api/error-response";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorizedResponse();

  const { id } = await ctx.params;

  const { data, error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("Failed to delete conversation", error);
    return errorResponse("대화를 삭제하지 못했습니다.", 500);
  }

  if (!data || data.length === 0) {
    return errorResponse("대화를 찾을 수 없습니다.", 404);
  }

  return new Response(null, { status: 204 });
}
