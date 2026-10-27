// 운영자 대시보드(/admin) 접근 확인과 지표 계산. 성공 지표는 01 프로젝트 정의, 측정은 04 기능 명세 12장.
// 따로 저장하지 않고 가입·답변 목록에서 읽을 때 계산하는 순수 함수다.
import { addDays, studyDay, weekStart } from "@/lib/streak";

// 운영자는 서버 환경변수 ADMIN_USER_IDS(쉼표로 구분한 사용자 id)에 든 계정뿐이다
export const isAdmin = (userId: string | undefined, ids = "") =>
  !!userId &&
  ids
    .split(",")
    .map((id) => id.trim())
    .includes(userId);

export const WEEKS = 8;

export type Signup = {
  userId: string;
  createdAt: string;
  onboardedAt: string | null;
};

// 답변을 제출한 턴 하나. idx 0이 본 질문, 1~3이 꼬리질문
export type Answer = {
  userId: string;
  idx: number;
  answeredAt: string;
  status: string;
  score: number | null;
  verdict: string | null;
  rating: number | null;
};

export const SCORE_BANDS = ["0–19", "20–39", "40–59", "60–79", "80–100"];

const ratio = (n: number, d: number) =>
  d === 0 ? null : Math.round((n / d) * 100);

// 답변은 최근 WEEKS주(이번 주 포함) 것만 읽는다
export const answersSince = (today: string) =>
  addDays(weekStart(today), -7 * (WEEKS - 1));

export function opsStats(signups: Signup[], answers: Answer[], today: string) {
  const thisWeek = weekStart(today);
  const weeks = Array.from({ length: WEEKS }, (_, i) =>
    addDays(thisWeek, -7 * (WEEKS - 1 - i)),
  );
  const main = answers.filter((a) => a.idx === 0);

  // 북극성: 주별 본 질문 제출 수
  const weekly = weeks.map((week) => ({ week, count: 0 }));
  const active = new Set<string>();
  for (const a of main) {
    const w = weekStart(studyDay(a.answeredAt));
    const row = weekly.find((r) => r.week === w);
    if (row) row.count++;
    if (w === thisWeek) active.add(a.userId);
  }

  // D7: 가입한 지 7~35일 된 사람 중 가입 다음 날부터 7일 안에 다시 답한 비율.
  // 방문 기록(#44)이 아직 없어 "다시 답함"을 재방문으로 본다
  const answeredDays = new Map<string, Set<string>>();
  for (const a of main) {
    const days = answeredDays.get(a.userId) ?? new Set();
    days.add(studyDay(a.answeredAt));
    answeredDays.set(a.userId, days);
  }
  const cohort = signups.filter((u) => {
    const day = studyDay(u.createdAt);
    return day <= addDays(today, -7) && day >= addDays(today, -35);
  });
  const returned = cohort.filter((u) => {
    const day = studyDay(u.createdAt);
    return [...(answeredDays.get(u.userId) ?? [])].some(
      (d) => d > day && d <= addDays(day, 7),
    );
  }).length;

  const rated = answers.filter((a) => a.rating != null);
  const graded = main.filter((a) => a.score != null);
  // 꼬리질문 판정별 개수(good·partial·wrong·unknown)
  const verdicts: Record<string, number> = {};
  for (const a of answers) {
    if (a.idx > 0 && a.verdict)
      verdicts[a.verdict] = (verdicts[a.verdict] ?? 0) + 1;
  }

  return {
    weekly,
    thisWeek: weekly[WEEKS - 1].count,
    lastWeek: weekly[WEEKS - 2].count,
    activeThisWeek: active.size,
    users: {
      total: signups.length,
      newThisWeek: signups.filter((u) => studyDay(u.createdAt) >= thisWeek)
        .length,
      onboardRate: ratio(
        signups.filter((u) => u.onboardedAt).length,
        signups.length,
      ),
    },
    d7: { rate: ratio(returned, cohort.length), cohort: cohort.length },
    thumbsUp: {
      rate: ratio(rated.filter((a) => a.rating === 1).length, rated.length),
      count: rated.length,
    },
    failRate: ratio(
      answers.filter((a) => a.status === "failed").length,
      answers.length,
    ),
    average: graded.length
      ? Math.round(graded.reduce((s, a) => s + a.score!, 0) / graded.length)
      : null,
    scoreBands: SCORE_BANDS.map(
      (_, i) =>
        graded.filter((a) => Math.min(Math.floor(a.score! / 20), 4) === i)
          .length,
    ),
    verdicts,
  };
}

export type OpsStats = ReturnType<typeof opsStats>;
