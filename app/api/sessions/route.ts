import { NextResponse } from "next/server";
import { z } from "zod";
import { startDailySession } from "@/lib/daily";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/track";

const error = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

const Body = z.union([
  z.object({ kind: z.literal("daily") }),
  z.object({ kind: z.literal("project"), questionId: z.number().int() }),
]);

// 세션 만들기(08 설계 4장). { kind: "daily" }면 오늘의 질문(같은 날에는 같은 세션),
// { kind: "project", questionId }면 내 프로젝트 질문 세션(그 질문의 열린 세션이 있으면 그것)
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return error(401, "UNAUTHORIZED", "로그인이 필요해요.");

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return error(400, "VALIDATION", "kind는 daily나 project여야 해요.");
  }

  if (body.data.kind === "project") {
    // 하루 한도 확인과 예약은 하루 사용 상한(#43)에서 start_project_session에 붙인다
    const { data: session, error: e } = await createAdminClient().rpc(
      "start_project_session",
      { p_user_id: userId, p_question_id: body.data.questionId },
    );
    if (e?.message === "NOT_FOUND") {
      return error(404, "NOT_FOUND", "질문을 찾을 수 없어요.");
    }
    if (e?.message === "NOT_OWNER") {
      return error(403, "NOT_OWNER", "내 질문이 아니에요.");
    }
    if (e) {
      console.error("start_project_session failed", e);
      return error(500, "INTERNAL", "연습을 시작하지 못했어요.");
    }
    // 열린 세션을 이어 할 때도 남는다. 지표는 session_id로 한 번만 센다
    await track(
      "session_start",
      { session_id: session.id, kind: "project" },
      userId,
    );
    return NextResponse.json({ session: { id: session.id } });
  }

  let session;
  try {
    session = await startDailySession(userId);
  } catch (e) {
    console.error("startDailySession failed", e);
    return error(500, "INTERNAL", "오늘의 질문을 만들지 못했어요.");
  }
  // exhausted면 화면이 "범위 안의 새 질문을 다 풀었어요. 범위를 넓혀볼까요?"를 보여준다
  return NextResponse.json({
    session,
    exhausted: session === null || session.pick === "advance",
  });
}
