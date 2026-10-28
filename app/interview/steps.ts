// 면접 화면 왼쪽 "지금까지" 흐름에 쓰는 지나온 단계. 본 질문은 점수, 꼬리질문은 판정
export type Step = {
  idx: number;
  prompt: string;
  score: number | null;
  verdict: string | null;
};

// 턴 목록(idx 순)에서 마지막(지금) 턴을 뺀 앞 단계들
export const steps = (
  turns: {
    idx: number | null;
    follow_up_prompt: string | null;
    score: number | null;
    verdict: string | null;
  }[],
  prompt: string,
): Step[] =>
  turns.slice(0, -1).map((t) => ({
    idx: t.idx ?? 0,
    prompt: t.follow_up_prompt ?? prompt,
    score: t.score,
    verdict: t.verdict,
  }));
