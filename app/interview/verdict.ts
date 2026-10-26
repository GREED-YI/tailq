// 꼬리질문 판정 문구와 점 색(docs/07 "면접", docs/09 "꼬리질문 채점"). 면접 화면과 오늘의 결과가 같이 쓴다
export const VERDICTS: Record<string, { label: string; color: string }> = {
  good: { label: "잘 답했어요", color: "var(--good)" },
  partial: { label: "조금 부족해요", color: "var(--mid)" },
  wrong: { label: "틀렸어요", color: "var(--low)" },
  unknown: { label: "모르겠어요", color: "var(--dot-off)" },
};
