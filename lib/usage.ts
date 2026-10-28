import "server-only";
import type { AiUsage } from "@/lib/ai";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// 하루 사용 상한과 월 예산(04 기능 명세 12장, 08 설계 "하루 사용 한도와 월 예산").
// 한도 확인과 예약은 DB 함수(ai_quota, start_*·create_project)가 잠금 안에서 하고, 여기서는 값을 넘기고 기록만 한다.

// 서비스 AI 월 예산(달러). 서버 환경변수 AI_MONTHLY_BUDGET_USD.
// 비어 있으면 docs/09 5장의 $20으로 본다(예산 없이 도는 것보다 막히는 쪽이 안전하다)
export function budgetUsd() {
  const n = Number(process.env.AI_MONTHLY_BUDGET_USD);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

// 시작 버튼 대신 보여주는 문구(04 기능 명세 12장). 개인 한도와 월 예산이 같은 문구를 쓴다
export const LIMIT_MESSAGE = "오늘은 사용 한도를 모두 썼어요. 내일 다시 만나요";

export type Quota = {
  budget: "ok" | "downgrade" | "exceeded";
  spentUsd: number;
  sessionsLeft: number;
  gensLeft: number;
};

// 남은 한도. 화면이 시작하기 전에 안내를 보일지 정하는 데 쓴다(실제로 막는 것은 시작 함수다)
export async function loadQuota(db: Admin, userId: string | null) {
  const { data } = await db
    .rpc("ai_quota", { p_user_id: userId!, p_budget_usd: budgetUsd() })
    .throwOnError();
  const q = data as {
    budget: Quota["budget"];
    spent_usd: number;
    sessions_left: number;
    gens_left: number;
  };
  return {
    budget: q.budget,
    spentUsd: Number(q.spent_usd),
    sessionsLeft: q.sessions_left,
    gensLeft: q.gens_left,
  } satisfies Quota;
}

// AI 호출 한 번을 ai_usage에 남긴다. 잡아 둔 몫(reserved)이 있으면 그 행을 바꾼다.
// 기록이 실패해도 사용자 요청은 실패시키지 않는다
export async function recordUsage(
  db: Admin,
  ref: {
    userId: string | null;
    purpose: "grade" | "follow_up" | "project_gen" | "note_gen" | "trial";
    refId: string;
  },
  usage: AiUsage,
) {
  const { error } = await db.rpc("record_ai_usage", {
    p_user_id: ref.userId!,
    p_purpose: ref.purpose,
    p_ref_id: ref.refId,
    p_usage: usage,
  });
  if (error) console.error("ai_usage record failed", ref, error);
}
