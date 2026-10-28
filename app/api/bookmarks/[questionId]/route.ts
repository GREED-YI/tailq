import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/turn";
import { errorResponse, withApiErrors } from "@/lib/api-error";

// 북마크 저장(PUT)·해제(DELETE). 여러 번 불러도 결과가 같다(08 설계 "멱등성")
async function setBookmark(
  ctx: RouteContext<"/api/bookmarks/[questionId]">,
  on: boolean,
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return errorResponse("UNAUTHORIZED", "로그인이 필요해요.");

  const { questionId } = await ctx.params;
  // 질문 번호는 int 범위 안의 양의 정수
  if (!/^[1-9]\d{0,8}$/.test(questionId)) {
    return errorResponse("NOT_FOUND", "질문을 찾을 수 없어요.");
  }

  try {
    await createAdminClient()
      .rpc("set_bookmark", {
        p_user_id: userId,
        p_question_id: Number(questionId),
        p_on: on,
      })
      .throwOnError();
  } catch (e) {
    return dbErrorResponse(e);
  }
  return Response.json({ bookmarked: on });
}

export const PUT = withApiErrors(
  async (_: Request, ctx: RouteContext<"/api/bookmarks/[questionId]">) =>
    setBookmark(ctx, true),
);

export const DELETE = withApiErrors(
  async (_: Request, ctx: RouteContext<"/api/bookmarks/[questionId]">) =>
    setBookmark(ctx, false),
);
