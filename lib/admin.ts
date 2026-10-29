// 운영자 대시보드(/admin) 접근 확인과 지표 계산. 성공 지표는 01 프로젝트 정의, 측정은 04 기능 명세 12장.
// 따로 저장하지 않고 가입·답변·이벤트 목록에서 읽을 때 계산하는 순수 함수다.
import { kstDay } from "@/lib/daily-pick";
import { addDays, studyDay, weekStart } from "@/lib/streak";

// 운영자는 서버 환경변수 ADMIN_USER_IDS(쉼표로 구분한 사용자 id)에 든 계정뿐이다
export const isAdmin = (userId: string | undefined, ids = "") =>
  !!userId &&
  ids
    .split(",")
    .map((id) => id.trim())
    .includes(userId);

// 북극성·채점 품질은 최근 8주, 성공 지표·가입 흐름은 최근 4주(01 "출시 후 4주 동안 본다"), 고장 신호는 최근 7일
const WEEKS = 8;
const GOAL_WEEKS = 4;
// 채점 실패율이 이 %를 넘으면 확인할 것에 올린다
export const FAIL_LIMIT = 5;

export type Signup = {
  userId: string;
  createdAt: string;
  onboardedAt: string | null;
};

// 답변을 제출한 턴 하나. idx 0이 본 질문, 1~3이 꼬리질문
export type Answer = {
  userId: string;
  questionId: number;
  idx: number;
  answeredAt: string;
  status: string;
  score: number | null;
  verdict: string | null;
  rating: number | null;
};

export const SCORE_BANDS = ["0–19", "20–39", "40–59", "60–79", "80–100"];

export const ratio = (n: number, d: number) =>
  d === 0 ? null : Math.round((n / d) * 100);

// 답변은 최근 WEEKS주(이번 주 포함) 것만 읽는다
export const answersSince = (today: string) =>
  addDays(weekStart(today), -7 * (WEEKS - 1));
// 최근 4주(이번 주 포함)의 첫날(월요일)
export const goalSince = (today: string) =>
  addDays(weekStart(today), -7 * (GOAL_WEEKS - 1));
// 최근 7일(오늘 포함)의 첫날
export const recentSince = (today: string) => addDays(today, -6);

// "2026-10-27T05:00:00Z" → 한국 날짜 "2026.10.27"(DESIGN 숫자형 날짜)
export const numericDate = (iso: string) =>
  kstDay(new Date(iso)).replaceAll("-", ".");

export function opsStats(signups: Signup[], answers: Answer[], today: string) {
  const thisWeek = weekStart(today);
  const weeks = Array.from({ length: WEEKS }, (_, i) =>
    addDays(thisWeek, -7 * (WEEKS - 1 - i)),
  );
  const main = answers.filter((a) => a.idx === 0);

  // 북극성: 주별 본 질문 제출 수. 지난주는 같은 요일까지만 세어 주 중간에도 이번 주와 견준다
  const weekly = weeks.map((week) => ({ week, count: 0 }));
  const active = new Set<string>();
  const sameDayLastWeek = addDays(today, -7);
  let lastWeekSoFar = 0;
  for (const a of main) {
    const day = studyDay(a.answeredAt);
    const w = weekStart(day);
    const row = weekly.find((r) => r.week === w);
    if (row) row.count++;
    if (w === thisWeek) active.add(a.userId);
    if (w === addDays(thisWeek, -7) && day <= sameDayLastWeek) lastWeekSoFar++;
  }

  // 채점 실패: 최근 7일 턴 중 실패(20초 넘게 멈춘 채점 포함) 비율
  const recent = answers.filter(
    (a) => studyDay(a.answeredAt) >= recentSince(today),
  );
  const failed = recent.filter((a) => a.status === "failed").length;

  // 채점 만족: 최근 4주 턴(본·꼬리)에 남긴 평가 중 좋아요
  const rated = answers.filter(
    (a) => a.rating != null && studyDay(a.answeredAt) >= goalSince(today),
  );
  const liked = rated.filter((a) => a.rating === 1).length;

  // 가입 흐름: 최근 4주 가입자 → 온보딩 마침 → 본 질문 첫 답변(4주 가입자의 답변은 8주 창 안에 다 있다)
  const answered = new Set(main.map((a) => a.userId));
  const cohort = signups.filter(
    (u) => studyDay(u.createdAt) >= goalSince(today),
  );
  const onboarded = cohort.filter((u) => u.onboardedAt);

  // 본 질문 점수 분포. "모르겠어요"(score 0, verdict unknown)는 따로 세고 분포·평균에서 뺀다
  const unknownMain = main.filter((a) => a.verdict === "unknown").length;
  const graded = main.filter((a) => a.score != null && a.verdict !== "unknown");
  // 꼬리질문 판정별 개수(good·partial·wrong·unknown)
  const verdicts: Record<string, number> = {};
  for (const a of answers) {
    if (a.idx > 0 && a.verdict)
      verdicts[a.verdict] = (verdicts[a.verdict] ?? 0) + 1;
  }

  return {
    weekly,
    thisWeek: weekly[WEEKS - 1].count,
    lastWeekSoFar,
    activeThisWeek: active.size,
    users: {
      total: signups.length,
      newThisWeek: signups.filter((u) => studyDay(u.createdAt) >= thisWeek)
        .length,
    },
    funnel: {
      signed: cohort.length,
      onboarded: onboarded.length,
      answered: onboarded.filter((u) => answered.has(u.userId)).length,
    },
    thumbsUp: { rate: ratio(liked, rated.length), rated: rated.length, liked },
    fail7d: { rate: ratio(failed, recent.length), n: recent.length, failed },
    average: graded.length
      ? Math.round(graded.reduce((s, a) => s + a.score!, 0) / graded.length)
      : null,
    scoreBands: SCORE_BANDS.map(
      (_, i) =>
        graded.filter((a) => Math.min(Math.floor(a.score! / 20), 4) === i)
          .length,
    ),
    unknownMain,
    verdicts,
  };
}

export type OpsStats = ReturnType<typeof opsStats>;

// metrics_weekly 뷰 한 줄(주는 월요일 시작, 한국 시간)
export type WeeklyMetric = {
  week: string;
  first_visitors: number;
  first_visitors_answered: number;
  d7_cohort: number;
  d7_returned: number;
};

// 첫 방문 → 첫 답변과 D7(이벤트 기준)을 최근 4주 행을 더해 계산한다. 주별 비율의 평균이 아니라 합 ÷ 합.
// D7은 가입 다음 날부터 7일 안에 세션 시작·답변 같은 이벤트를 다시 남긴 비율이다(로그인한 사람의 순수 방문은 아직 기록하지 않는다)
export function goalRates(rows: WeeklyMetric[], today: string) {
  const since = goalSince(today);
  const sum = (key: keyof Omit<WeeklyMetric, "week">) =>
    rows.filter((r) => r.week >= since).reduce((s, r) => s + r[key], 0);
  const visitors = sum("first_visitors");
  const reached = sum("first_visitors_answered");
  const cohort = sum("d7_cohort");
  const returned = sum("d7_returned");
  return {
    firstAnswer: {
      rate: ratio(reached, visitors),
      visitors,
      answered: reached,
    },
    d7: { rate: ratio(returned, cohort), cohort, returned },
  };
}

// 방문 흐름 앞단: 최근 4주에 처음 온 브라우저(first_visit) 중 체험을 마친 수. metrics_weekly visits와 같은 코호트다
export function visitFunnel(
  events: { name: string; anon_id: string | null }[],
) {
  const visitors = new Set<string>();
  const trialed = new Set<string>();
  for (const e of events) {
    if (!e.anon_id) continue;
    if (e.name === "first_visit") visitors.add(e.anon_id);
    if (e.name === "trial_complete") trialed.add(e.anon_id);
  }
  return {
    visitors: visitors.size,
    trialed: [...trialed].filter((id) => visitors.has(id)).length,
  };
}

// 흐름 단계마다 비교할 앞 단계 대비 %와 첫 단계 대비 %(막대). skippable 단계(체험)는 건너뛰어도 되므로
// 그다음 단계는 그 앞 단계와 견준다
export function funnelSteps(
  steps: { label: string; n: number; skippable?: boolean }[],
) {
  return steps.map((step, i) => {
    let base = i - 1;
    if (base > 0 && steps[base].skippable) base--;
    return {
      ...step,
      base: base >= 0 ? steps[base].label : null,
      ofBase: base >= 0 ? ratio(step.n, steps[base].n) : null,
      ofFirst: ratio(step.n, steps[0].n) ?? 0,
    };
  });
}

type Alert = { label: string; text: string; href: string };

// 확인할 것: 고장 신호만. 순서는 예산 멈춤 → 채점 실패 → 예산 80% → 버그 → 신고
export function alerts(
  fail: { rate: number | null },
  budget: "ok" | "downgrade" | "exceeded",
  recent: { bug: number; report: number },
): Alert[] {
  const list: Alert[] = [];
  if (budget === "exceeded")
    list.push({
      label: "예산",
      text: "이번 달 AI 예산을 다 써서 오늘의 질문까지 새로 시작할 수 없어요",
      href: "#ops",
    });
  if ((fail.rate ?? 0) > FAIL_LIMIT)
    list.push({
      label: "채점",
      text: `최근 7일 채점 실패가 ${fail.rate}%예요`,
      href: "#ops",
    });
  if (budget === "downgrade")
    list.push({
      label: "예산",
      text: "이번 달 AI 비용이 예산의 80%를 넘어 가벼운 모델로 채점하고 있어요",
      href: "#ops",
    });
  if (recent.bug > 0)
    list.push({
      label: "피드백",
      text: `최근 7일 버그 피드백 ${recent.bug}개`,
      href: "/admin/feedback?category=bug",
    });
  if (recent.report > 0)
    list.push({
      label: "피드백",
      text: `최근 7일 신고 피드백 ${recent.report}개`,
      href: "/admin/feedback?category=report",
    });
  return list;
}

// 지금 속도면 이번 달 말에 쓸 비용(달러). 달 초에는 하루 이틀 값으로 크게 튀므로 3일째부터 낸다
export function monthForecast(spentUsd: number, today: string) {
  const day = Number(today.slice(8, 10));
  if (day < 3) return null;
  const [y, m] = today.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.round((spentUsd / day) * days * 100) / 100;
}

// 채점 지연 중간값·95번째(가까운 순위 방식). 기록이 없으면 null
export function latency(ms: number[]) {
  if (ms.length === 0) return null;
  const sorted = [...ms].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.ceil(p * sorted.length) - 1];
  return { p50: at(0.5), p95: at(0.95), n: sorted.length };
}

// 싫어요(rating -1)를 많이 받은 질문 순. 같으면 평가가 많은 쪽, 그다음 번호 순
export function thumbsDownQuestions(answers: Answer[], limit = 5) {
  const by = new Map<
    number,
    { questionId: number; down: number; rated: number }
  >();
  for (const a of answers) {
    if (a.rating == null) continue;
    const q = by.get(a.questionId) ?? {
      questionId: a.questionId,
      down: 0,
      rated: 0,
    };
    q.rated++;
    if (a.rating === -1) q.down++;
    by.set(a.questionId, q);
  }
  return [...by.values()]
    .filter((q) => q.down > 0)
    .sort(
      (a, b) =>
        b.down - a.down || b.rated - a.rated || a.questionId - b.questionId,
    )
    .slice(0, limit);
}
