import "server-only";
import { cookies } from "next/headers";
import { QUESTION_COLUMNS, toSessionQuestion } from "@/lib/daily";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRIAL_COOKIE } from "@/lib/trial";

// 체험 화면이 읽는 이 브라우저의 체험 세션. 로그인 토큰이 없어 RLS로 못 읽으므로, 쿠키의 토큰으로
// 소유를 확인한 뒤 service_role로 그 세션과 턴만 읽는다(08 설계 "데이터 읽고 쓰는 길"의 체험 예외).
export async function loadTrialSession() {
  const token = (await cookies()).get(TRIAL_COOKIE)?.value;
  if (!token) return null;
  const { data } = await createAdminClient()
    .from("sessions")
    .select(
      `id, status, questions(${QUESTION_COLUMNS}), turn_states(id, idx, follow_up_prompt, effective_status, answer, grading_attempts, score, verdict, feedback)`,
    )
    .eq("trial_token", token)
    .eq("kind", "trial")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .throwOnError();
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    question: toSessionQuestion(data.questions),
    turns: [...data.turn_states].sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0)),
  };
}
