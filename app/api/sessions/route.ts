import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/track";
import { budgetUsd, LIMIT_MESSAGE } from "@/lib/usage";
import { errorResponse, withApiErrors } from "@/lib/api-error";

const Body = z.object({
  kind: z.literal("project"),
  questionId: z.number().int(),
});

// 내 프로젝트·학습 자료 질문 세션 만들기(08 설계 4장). 그 질문의 열린 세션이 있으면 그것을 돌려준다.
// 오늘의 질문 세션은 홈·면접 화면이 서버에서 startDailySession으로 바로 만든다
export const POST = withApiErrors(async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return errorResponse("UNAUTHORIZED", "로그인이 필요해요.");

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return errorResponse(
      "VALIDATION",
      "kind는 project, questionId는 정수여야 해요.",
    );
  }

  // 새 세션이면 월 예산·하루 한도를 확인하고 본 질문 채점 몫을 예약한다(이어 하는 세션은 보지 않는다)
  const { data: session, error: e } = await createAdminClient().rpc(
    "start_project_session",
    {
      p_user_id: userId,
      p_question_id: body.data.questionId,
      p_budget_usd: budgetUsd(),
    },
  );
  if (e?.message === "NOT_FOUND") {
    return errorResponse("NOT_FOUND", "질문을 찾을 수 없어요.");
  }
  if (e?.message === "NOT_OWNER") {
    return errorResponse("NOT_OWNER", "내 질문이 아니에요.");
  }
  if (e?.message === "LIMIT_EXCEEDED" || e?.message === "BUDGET_EXCEEDED") {
    return errorResponse(e.message, LIMIT_MESSAGE);
  }
  if (e) {
    console.error("start_project_session failed", e);
    return errorResponse("INTERNAL", "연습을 시작하지 못했어요.");
  }
  // 열린 세션을 이어 할 때도 남는다. 지표는 session_id로 한 번만 센다
  await track(
    "session_start",
    { session_id: session.id, kind: "project" },
    userId,
  );
  return NextResponse.json({ session: { id: session.id } });
});
