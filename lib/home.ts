// 홈의 세 상태(04 기능 명세 "화면 목록" S10 오늘 안 풂 · S11 하던 중 · S12 오늘 완료)
export type HomeState =
  | { kind: "todo" }
  // step: 진행 중인 턴(0 본 질문 채점 중·실패, 1~3 꼬리질문)
  | { kind: "doing"; step: number }
  | { kind: "done" };

// 오늘 세션 상태와 idx 순서의 턴 목록으로 정한다. 본 질문에 아직 답하지 않았으면 오늘 안 풂
export function homeState(
  sessionStatus: string,
  turns: { idx: number; status: string }[],
): HomeState {
  if (sessionStatus !== "open") return { kind: "done" };
  const last = turns.at(-1);
  if (!last || (last.idx === 0 && last.status === "answering")) {
    return { kind: "todo" };
  }
  return { kind: "doing", step: last.idx };
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// "2026-10-22" → "2026.10.22 THU"
export const dayLabel = (day: string) =>
  `${day.replaceAll("-", ".")} ${WEEKDAYS[new Date(Date.parse(day)).getUTCDay()]}`;
