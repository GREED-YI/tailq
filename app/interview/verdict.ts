// 꼬리질문 판정 문구·색·모양(docs/07 "면접", docs/09 "꼬리질문 채점", DESIGN.md verdict-mark).
// 색만으로 말하지 않도록 모양을 함께 쓴다: 채운 원·반쪽 원·네모·빈 원. 면접 화면·오늘의 결과·기록이 같이 쓴다
type Shape = "fill" | "half" | "square" | "empty";

export const VERDICTS: Record<
  string,
  { label: string; color: string; shape: Shape }
> = {
  good: { label: "잘 답했어요", color: "var(--text)", shape: "fill" },
  partial: { label: "조금 부족해요", color: "var(--text-sub)", shape: "half" },
  wrong: { label: "틀렸어요", color: "var(--danger)", shape: "square" },
  unknown: { label: "모르겠어요", color: "var(--text-muted)", shape: "empty" },
};

// 본 질문 점수 구간 색(docs/09 1장: 70점이 "잘 답함", 40점 미만은 핵심 대부분이 빠짐)
export const scoreColor = (score: number) =>
  score >= 70
    ? "var(--text)"
    : score >= 40
      ? "var(--text-sub)"
      : "var(--danger)";

// 본 질문 점수를 같은 구간의 판정으로 읽는다(점수 옆 판정 표시와 단계별 결과의 모양 점)
export const scoreVerdict = (score: number) =>
  score >= 70 ? "good" : score >= 40 ? "partial" : "wrong";
