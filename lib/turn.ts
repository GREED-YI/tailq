import "server-only";
import {
  errorResponse,
  INTERNAL_MESSAGE,
  type ErrorCode,
} from "@/lib/api-error";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type Link = { title: string; url: string };

// 채점 결과(08 설계 "스트리밍 프로토콜"의 result 이벤트). "모르겠어요" JSON 응답과 화면 다시 열기도 같은 모양이다
export type TurnResult = {
  turnId: string;
  status: "graded";
  score: number | null;
  verdict: string | null;
  feedback: { summary: string; good: string[]; improve: string[] } | null;
  missingKeywords: string[];
  modelAnswer: string;
  links: Link[];
  nextTurn: { id: string; idx: number; prompt: string } | null;
  session: { status: string; nextReviewDay: string | null };
  rating: number | null;
};

// 꼬리질문 턴은 summary만 있다(08 설계 "jsonb 스키마")
type Feedback = {
  summary: string;
  good?: string[];
  improve?: string[];
  missing_keywords?: string[];
};

// 채점이 끝난 턴의 결과를 DB에서 읽는다. 모범 답안은 서버 전용 테이블에서 꺼내므로,
// 부르는 쪽이 "이 사용자의 턴이고 채점이 끝났다"를 먼저 확인해야 한다(08 설계 "모범 답안과 기대 답안 보호").
export async function turnResult(
  db: Admin,
  turnId: string,
): Promise<TurnResult> {
  const { data: t } = await db
    .from("turns")
    .select(
      "id, idx, score, verdict, feedback, rating, session_id, turn_keys(expected_answer), sessions(status, user_id, question_id, questions(question_keys(model_answer, links)))",
    )
    .eq("id", turnId)
    .single()
    .throwOnError();
  const s = t.sessions;
  const [next, review] = await Promise.all([
    db
      .from("turns")
      .select("id, idx, follow_up_prompt")
      .eq("session_id", t.session_id)
      .eq("idx", t.idx + 1)
      .maybeSingle()
      .throwOnError(),
    // 체험 세션은 사용자가 없어 복습 칸도 없다
    s.user_id
      ? db
          .from("reviews")
          .select("box, due_day")
          .eq("user_id", s.user_id)
          .eq("question_id", s.question_id)
          .maybeSingle()
          .throwOnError()
      : { data: null },
  ]);
  // 꼬리질문은 모범 답안 대신 그 꼬리질문의 기대 답안, 참고 자료는 없다
  const keys = s.questions.question_keys;
  const followUp = t.idx > 0;
  const fb = t.feedback as Feedback | null;
  return {
    turnId: t.id,
    status: "graded",
    score: t.score,
    verdict: t.verdict,
    feedback: fb && {
      summary: fb.summary,
      good: fb.good ?? [],
      improve: fb.improve ?? [],
    },
    missingKeywords: fb?.missing_keywords ?? [],
    modelAnswer: followUp
      ? (t.turn_keys?.expected_answer ?? "")
      : (keys?.model_answer ?? ""),
    links: followUp ? [] : ((keys?.links as Link[] | null) ?? []),
    nextTurn: next.data && {
      id: next.data.id,
      idx: next.data.idx,
      prompt: next.data.follow_up_prompt ?? "",
    },
    session: {
      status: s.status,
      nextReviewDay: review.data?.box ? review.data.due_day : null,
    },
    rating: t.rating,
  };
}

// DB 함수가 던진 에러 코드 → 메시지. HTTP 상태는 lib/api-error의 목록이 정한다(08 설계 "에러 형식")
const MESSAGES: Partial<Record<ErrorCode, string>> = {
  VALIDATION: "답변은 30자 이상 2,000자 이하로 써 주세요.",
  NOT_FOUND: "질문을 찾을 수 없어요.",
  NOT_OWNER: "내 질문이 아니에요.",
  ALREADY_GRADED: "이미 채점이 끝났어요.",
  NOT_GRADED: "채점이 끝난 뒤에 평가할 수 있어요.",
  GRADING_IN_PROGRESS: "채점하고 있어요. 잠시 뒤에 다시 확인해 주세요.",
  SESSION_CLOSED: "지난 질문에는 더 답할 수 없어요.",
  REGRADE_LIMIT: "오늘은 더 다시 채점할 수 없어요.",
};

export function dbErrorResponse(e: unknown) {
  const code = (e as { message?: string } | null)?.message as ErrorCode;
  const message = MESSAGES[code];
  if (message) return errorResponse(code, message);
  console.error("turn write failed", e);
  return errorResponse("INTERNAL", INTERNAL_MESSAGE);
}
