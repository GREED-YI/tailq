import { z } from "zod";
import { projectErrorResponse } from "@/lib/projects";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/turn";

// 프로젝트 삭제(08 설계 4장). 그 질문·기록·복습 일정이 함께 지워진다.
// 오늘의 질문으로 나온 프로젝트면 409 PROJECT_IN_TODAY_SESSION
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/projects/[id]">,
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return errorResponse(401, "UNAUTHORIZED", "로그인이 필요해요.");

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return errorResponse(404, "NOT_FOUND", "프로젝트를 찾을 수 없어요.");
  }

  try {
    await createAdminClient()
      .rpc("delete_project", { p_user_id: userId, p_project_id: id })
      .throwOnError();
  } catch (e) {
    return projectErrorResponse(e);
  }
  return new Response(null, { status: 204 });
}
