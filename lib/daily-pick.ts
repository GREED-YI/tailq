// 오늘의 질문 고르기 규칙(04 기능 명세 3번). 입력만 보고 정하는 순수 함수라 단위 테스트로 지킨다.
// 날짜는 모두 한국 시간 "YYYY-MM-DD" 문자열이라 문자열 비교가 곧 날짜 비교다.

export type Pick = "review" | "new" | "advance";

export type PickInput = {
  today: string;
  // 연습 범위. levels가 비어 있으면 모든 난이도
  topics: string[];
  levels: string[];
  // 숨기지 않은 은행 질문
  bank: { id: number; topicId: string; level: string }[];
  // 복습 중인 질문(익힌 질문·숨긴 질문 제외)
  reviews: { questionId: number; dueDay: string }[];
  // 지난 세션. answered는 본 질문을 제출했는지
  sessions: {
    questionId: number;
    topicId: string | null;
    day: string;
    answered: boolean;
  }[];
};

export type PickResult = { pick: Pick; questionId: number } | { pick: null };

// 한국은 서머타임이 없어 UTC+9로 고정이다
export function kstDay(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

const byDue = (a: PickInput["reviews"][0], b: PickInput["reviews"][0]) =>
  a.dueDay.localeCompare(b.dueDay) || a.questionId - b.questionId;

export function pickDailyQuestion(input: PickInput): PickResult {
  const { today } = input;
  const reviews = [...input.reviews].sort(byDue);

  // 1. 복습일이 된 질문 중 가장 오래 밀린 것. 며칠 놓쳐도 사라지지 않는다
  const due = reviews.find((r) => r.dueDay <= today);
  if (due) return { pick: "review", questionId: due.questionId };

  // 2. 범위 안의 아직 안 푼 새 질문. 가장 오래전에 나온 주제(안 나온 주제가 먼저)에서 고른다.
  //    본 질문을 내지 않고 놓친 질문은 푼 것이 아니라 나중에 새 질문으로 다시 나올 수 있다
  const solved = new Set([
    ...input.sessions.filter((s) => s.answered).map((s) => s.questionId),
    ...input.reviews.map((r) => r.questionId),
  ]);
  const candidates = input.bank
    .filter(
      (q) =>
        input.topics.includes(q.topicId) &&
        (input.levels.length === 0 || input.levels.includes(q.level)) &&
        !solved.has(q.id),
    )
    .sort((a, b) => a.id - b.id);

  if (candidates.length > 0) {
    const lastSeen = new Map<string, string>();
    for (const s of input.sessions) {
      if (s.topicId && s.day > (lastSeen.get(s.topicId) ?? "")) {
        lastSeen.set(s.topicId, s.day);
      }
    }
    const topic = input.topics
      .filter((t) => candidates.some((q) => q.topicId === t))
      .reduce((a, b) =>
        (lastSeen.get(b) ?? "") < (lastSeen.get(a) ?? "") ? b : a,
      );
    const q = candidates.find((c) => c.topicId === topic)!;
    return { pick: "new", questionId: q.id };
  }

  // 3. 범위 소진: 가장 가까운 복습 예정 질문을 앞당긴다(화면은 범위를 넓히자고 안내한다)
  const next = reviews.find((r) => r.dueDay > today);
  if (next) return { pick: "advance", questionId: next.questionId };

  // 낼 질문이 하나도 없다(범위가 비었거나 모두 익혔다)
  return { pick: null };
}
