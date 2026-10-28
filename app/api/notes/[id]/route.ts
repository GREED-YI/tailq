import { z } from "zod";
import { noteErrorResponse } from "@/lib/notes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, withApiErrors } from "@/lib/api-error";

// 학습 자료 삭제(08 설계 4장, #141). 그 질문·기록·복습 일정이 함께 지워진다.
// 오늘의 질문으로 나온 학습 자료면 409 NOTE_IN_TODAY_SESSION
export const DELETE = withApiErrors(async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/notes/[id]">,
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return errorResponse("UNAUTHORIZED", "로그인이 필요해요.");

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return errorResponse("NOT_FOUND", "학습 자료를 찾을 수 없어요.");
  }

  try {
    await createAdminClient()
      .rpc("delete_note", { p_user_id: userId, p_note_id: id })
      .throwOnError();
  } catch (e) {
    return noteErrorResponse(e);
  }
  return new Response(null, { status: 204 });
});
