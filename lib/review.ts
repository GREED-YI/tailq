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

// 내 질문 화면(/questions) 필터. 옛 복습 화면(/review)은 위 matchesFilter를 그대로 쓴다
export type QuestionFilter = "today" | "week" | "bookmark" | "mastered" | "all";
export const QUESTION_FILTERS: QuestionFilter[] = [
  "today",
  "week",
  "bookmark",
  "mastered",
  "all",
];

// dueDay가 null이면 복습 정보가 없거나 숨긴 질문이다(복습 필터에 들지 않는다)
export type QuestionItem = {
  box: number | null;
  dueDay: string | null;
  bookmarked: boolean;
};

export function inQuestionFilter(
  r: QuestionItem,
  f: QuestionFilter,
  today: string,
): boolean {
  if (f === "all") return true;
  if (f === "bookmark") return r.bookmarked;
  if (r.dueDay === null) return false;
  if (f === "mastered") return r.box === null;
  return matchesFilter({ box: r.box, dueDay: r.dueDay }, f, today);
}

// 알맞은 값이면 그대로, 아니면 오늘 복습이 하나라도 있을 때 "today", 없으면 "all"
export const questionFilter = (
  v: unknown,
  items: QuestionItem[],
  today: string,
): QuestionFilter =>
  QUESTION_FILTERS.includes(v as QuestionFilter)
    ? (v as QuestionFilter)
    : items.some((r) => inQuestionFilter(r, "today", today))
      ? "today"
      : "all";
