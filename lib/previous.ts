// 복습 질문의 "지난번"(#131, 04 기능 명세 4번). 면접 화면이 답변 칸 위 접힘과 채점 결과의 점수 변화 줄에 쓴다.

// 지난번 본 질문 기록. score가 null이면 모르겠어요
export type Previous = {
  day: string; // "YYYY-MM-DD"(한국 날짜)
  score: number | null;
  answer: string | null;
  summary: string | null; // 한 줄 평(feedback.summary)
};

// 같은 질문의 내 세션들. 최근 것부터(day, created_at 내림차순) 온다
type PastSession = {
  id: string;
  day: string;
  status: string;
  turns: {
    idx: number;
    status: string;
    answer: string | null;
    score: number | null;
    verdict: string | null;
    feedback: unknown;
  }[];
};

// 오늘 세션을 뺀 끝난 세션 중 본 질문이 채점된 가장 최근 것. 채점이 안 된 세션은 건너뛰고 그 전 것을 쓴다
// (Q노트 질문 상세의 기록 목록과 같은 기준). 꼬리질문은 점수가 없어 쓰지 않는다
export function pickPrevious(
  sessions: PastSession[],
  todayId: string,
): Previous | null {
  for (const s of sessions) {
    if (s.id === todayId || s.status !== "done") continue;
    const t = s.turns.find((t) => t.idx === 0 && t.status === "graded");
    if (!t) continue;
    // 모르겠어요는 0점으로 기록되지만 화면에서는 점수가 아니다
    if (t.verdict === "unknown")
      return { day: s.day, score: null, answer: null, summary: null };
    return {
      day: s.day,
      score: t.score,
      answer: t.answer,
      summary: (t.feedback as { summary?: string } | null)?.summary ?? null,
    };
  }
  return null;
}

// 점수 변화 줄. 방향은 색이 아니라 기호(+, -, ±)와 화면 읽기 문장이 전한다.
// today가 undefined면 채점 중, null이면 오늘 모르겠어요. 한쪽이 모르겠어요면 변화량을 쓰지 않는다(0점 대비 변화는 거짓 정보다)
export function scoreChange(
  prev: number | null,
  today: number | null | undefined,
): { delta: string | null; tone: "up" | "same" | "down" | null; sr: string } {
  const none = { delta: null, tone: null };
  if (today === undefined)
    return {
      ...none,
      sr:
        prev === null
          ? "지난번엔 모르겠어요를 골랐어요."
          : `지난번 ${prev}점이었어요.`,
    };
  if (prev === null)
    return {
      ...none,
      sr:
        today === null
          ? "지난번과 오늘 모두 모르겠어요를 골랐어요."
          : `지난번엔 모르겠어요, 오늘은 ${today}점이에요.`,
    };
  if (today === null)
    return { ...none, sr: `지난번 ${prev}점, 오늘은 모르겠어요를 골랐어요.` };
  const d = today - prev;
  if (d === 0)
    return { delta: "±0", tone: "same", sr: `지난번과 같은 ${prev}점이에요.` };
  return d > 0
    ? {
        delta: `+${d}`,
        tone: "up",
        sr: `지난번 ${prev}점, 오늘 ${today}점이에요. ${d}점 올랐어요.`,
      }
    : {
        delta: `${d}`,
        tone: "down",
        sr: `지난번 ${prev}점, 오늘 ${today}점이에요. ${-d}점 내려갔어요.`,
      };
}
