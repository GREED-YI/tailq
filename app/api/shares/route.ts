import { z } from "zod";
import { loadStudy } from "@/lib/study";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/track";
import { dbErrorResponse, errorResponse } from "@/lib/turn";

const Body = z.strictObject({ sessionId: z.uuid() });

// 결과 공유 카드 만들기(08 설계 4장). sessionId만 받고 점수·주제·닉네임은 DB 함수가, 꼬리잇기는 서버가 계산한다.
// 세션당 하나라 다시 불러도 같은 카드를 돌려준다(멱등)
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return errorResponse(401, "UNAUTHORIZED", "로그인이 필요해요.");

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return errorResponse(400, "VALIDATION", "공유할 세션을 알 수 없어요.");
  }
  const { sessionId } = body.data;

  // 꼬리잇기를 못 읽어도 카드는 만든다(0이면 카드에 꼬리잇기를 적지 않는다)
  const study = await loadStudy().catch(() => null);
  let id: string | null;
  try {
    ({ data: id } = await createAdminClient()
      .rpc("create_share", {
        p_user_id: userId,
        p_session_id: sessionId,
        p_streak: study?.streak.current ?? 0,
      })
      .throwOnError());
  } catch (e) {
    return dbErrorResponse(e);
  }
  if (!id) {
    return errorResponse(404, "NOT_FOUND", "공유할 결과를 찾을 수 없어요.");
  }

  await track("share", { session_id: sessionId }, userId);
  return Response.json({ id, url: `/s/${id}` });
}
