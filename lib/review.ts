// 복습 목록 화면 규칙(04 기능 명세 5번). 칸 옮기기는 DB 함수 apply_review가 한다.
// 날짜는 모두 한국 시간 "YYYY-MM-DD" 문자열이다.

export type ReviewFilter = "all" | "today" | "week" | "mastered";

// box가 null이면 익힌 질문(복습에서 빠진다)
export type ReviewItem = { box: number | null; dueDay: string };

export const daysUntil = (dueDay: string, today: string) =>
  (Date.parse(dueDay) - Date.parse(today)) / 86_400_000;

// 전체·오늘·이번 주는 복습 중인 질문만. 밀린 질문은 오늘로 친다. 이번 주는 오늘부터 7일 안
export function matchesFilter(
  r: ReviewItem,
  filter: ReviewFilter,
  today: string,
): boolean {
  if (filter === "mastered") return r.box === null;
  if (r.box === null) return false;
  if (filter === "all") return true;
  const days = daysUntil(r.dueDay, today);
  return filter === "today" ? days <= 0 : days < 7;
}

export const dueLabel = (days: number) =>
  days <= 0 ? "오늘 다시" : days === 1 ? "내일 다시" : `${days}일 뒤 다시`;
