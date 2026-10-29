import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/server/track";
import { dbErrorResponse } from "@/lib/server/turn";
import { errorResponse, withApiErrors } from "@/lib/server/api-error";

const Body = z.object({ rating: z.union([z.literal(1), z.literal(-1)]) });

// 채점 결과 👍(1)/👎(-1). 여러 번 보내도 마지막 값이 남는다(08 설계 "멱등성")
export const PUT = withApiErrors(async function PUT(
  request: Request,
  ctx: RouteContext<"/api/turns/[id]/rating">,
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return errorResponse("UNAUTHORIZED", "로그인이 필요해요.");

  const { id } = await ctx.params;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return errorResponse("VALIDATION", "rating은 1 또는 -1이어야 해요.");
  }
  if (!z.uuid().safeParse(id).success) {
    return errorResponse("NOT_FOUND", "질문을 찾을 수 없어요.");
  }

  try {
    await createAdminClient()
      .rpc("set_turn_rating", {
        p_turn_id: id,
        p_user_id: userId,
        p_rating: body.data.rating,
      })
      .throwOnError();
  } catch (e) {
    return dbErrorResponse(e);
  }
  await track("rating", { turn_id: id, rating: body.data.rating }, userId);
  return Response.json({ rating: body.data.rating });
});
