import { describe, expect, it } from "vitest";
import {
  alerts,
  answersSince,
  funnelSteps,
  goalRates,
  isAdmin,
  latency,
  monthForecast,
  numericDate,
  opsStats,
  thumbsDownQuestions,
  visitFunnel,
  type Answer,
  type Signup,
  type WeeklyMetric,
} from "@/lib/admin";

// 2026-10-28은 수요일, 이번 주는 10-26(월)부터. 시각은 한국 시간 낮 12시
const TODAY = "2026-10-28";
const at = (day: string) => `${day}T12:00:00+09:00`;
const signup = (userId: string, day: string, onboarded = true): Signup => ({
  userId,
  createdAt: at(day),
  onboardedAt: onboarded ? at(day) : null,
});
const answer = (
  userId: string,
  day: string,
  more: Partial<Answer> = {},
): Answer => ({
  userId,
  questionId: 1,
  idx: 0,
  answeredAt: at(day),
  status: "graded",
  score: 70,
  verdict: null,
  rating: null,
  ...more,
});

describe("isAdmin", () => {
  it("ADMIN_USER_IDS에 든 계정만 운영자다", () => {
    expect(isAdmin("a", "x, a ,y")).toBe(true);
    expect(isAdmin("b", "x,a")).toBe(false);
  });

  it("로그인하지 않았거나 목록이 비면 아무도 운영자가 아니다", () => {
    expect(isAdmin(undefined, "a")).toBe(false);
    expect(isAdmin("", "")).toBe(false);
    expect(isAdmin("a")).toBe(false);
  });
});

describe("opsStats", () => {
  it("데이터가 없으면 비율은 null", () => {
    const r = opsStats([], [], TODAY);
    expect(r.weekly).toHaveLength(8);
    expect(r.thisWeek).toBe(0);
    expect(r.users).toEqual({ total: 0, newThisWeek: 0 });
    expect(r.funnel).toEqual({ signed: 0, onboarded: 0, answered: 0 });
    expect(r.thumbsUp.rate).toBeNull();
    expect(r.fail7d).toEqual({ rate: null, n: 0, failed: 0 });
    expect(r.average).toBeNull();
  });

  it("주별 본 질문 제출 수와 이번 주 답한 사람 수를 센다", () => {
    const r = opsStats(
      [],
      [
        answer("a", "2026-10-26"),
        answer("a", "2026-10-27"),
        answer("b", "2026-10-28"),
        answer("a", "2026-10-26", { idx: 1, score: null }),
        answer("c", "2026-10-25"),
      ],
      TODAY,
    );
    expect(r.weekly.at(-1)).toEqual({ week: "2026-10-26", count: 3 });
    expect(r.thisWeek).toBe(3);
    expect(r.activeThisWeek).toBe(2);
    expect(r.weekly[0].week).toBe(answersSince(TODAY));
  });

  it("지난주는 같은 요일까지만 센다(수요일이면 지난주 월~수)", () => {
    const last = ["2026-10-19", "2026-10-21", "2026-10-22", "2026-10-25"];
    const r = opsStats(
      [],
      last.map((d) => answer("a", d)),
      TODAY,
    );
    expect(r.lastWeekSoFar).toBe(2);
    expect(r.weekly.at(-2)?.count).toBe(4);
  });

  it("월요일엔 지난 월요일만, 일요일엔 지난주 전체와 견준다", () => {
    const last = ["2026-10-19", "2026-10-20", "2026-10-25"].map((d) =>
      answer("a", d),
    );
    expect(opsStats([], last, "2026-10-26").lastWeekSoFar).toBe(1);
    const before = ["2026-10-12", "2026-10-18"].map((d) => answer("a", d));
    expect(opsStats([], before, "2026-10-25").lastWeekSoFar).toBe(2);
  });

  it("가입 흐름은 최근 4주 가입자 → 온보딩 → 본 질문 첫 답변", () => {
    const r = opsStats(
      [
        signup("a", "2026-10-05"),
        signup("b", "2026-10-26", false),
        signup("c", "2026-10-28"),
        signup("old", "2026-10-04"),
      ],
      [
        answer("a", "2026-10-06"),
        answer("old", "2026-10-06"),
        answer("c", "2026-10-28", { idx: 1 }),
      ],
      TODAY,
    );
    expect(r.users).toEqual({ total: 4, newThisWeek: 2 });
    expect(r.funnel).toEqual({ signed: 3, onboarded: 2, answered: 1 });
  });

  it("채점 실패율은 오늘 포함 최근 7일 턴만 본다", () => {
    const r = opsStats(
      [],
      [
        answer("a", "2026-10-22", { status: "failed" }),
        answer("a", "2026-10-21", { status: "failed" }),
        answer("a", TODAY),
        answer("a", TODAY, { idx: 1 }),
      ],
      TODAY,
    );
    expect(r.fail7d).toEqual({ rate: 33, n: 3, failed: 1 });
  });

  it("채점 만족은 최근 4주 평가만 센다", () => {
    const r = opsStats(
      [],
      [
        answer("a", "2026-10-05", { rating: 1 }),
        answer("a", "2026-10-04", { rating: -1 }),
        answer("a", TODAY, { rating: -1, idx: 2 }),
      ],
      TODAY,
    );
    expect(r.thumbsUp).toEqual({ rate: 50, rated: 2, liked: 1 });
  });

  it("점수 분포·평균에서 본 질문 모르겠어요를 빼고 따로 센다", () => {
    const r = opsStats(
      [],
      [
        answer("a", TODAY, { score: 100 }),
        answer("a", TODAY, { score: 0, verdict: "unknown" }),
        answer("a", TODAY, { score: 45 }),
        answer("a", TODAY, { score: 10 }),
        answer("a", TODAY, { status: "failed", score: null }),
        answer("a", TODAY, { idx: 1, score: null, verdict: "good" }),
        answer("a", TODAY, { idx: 2, score: null, verdict: "unknown" }),
      ],
      TODAY,
    );
    expect(r.average).toBe(52);
    expect(r.scoreBands).toEqual([1, 0, 1, 0, 1]);
    expect(r.unknownMain).toBe(1);
    expect(r.verdicts).toEqual({ good: 1, unknown: 1 });
  });
});

describe("goalRates", () => {
  const row = (week: string, v: Partial<WeeklyMetric>): WeeklyMetric => ({
    week,
    first_visitors: 0,
    first_visitors_answered: 0,
    d7_cohort: 0,
    d7_returned: 0,
    ...v,
  });

  it("기록이 없으면 비율은 null", () => {
    expect(goalRates([], TODAY)).toEqual({
      firstAnswer: { rate: null, visitors: 0, answered: 0 },
      d7: { rate: null, cohort: 0, returned: 0 },
    });
  });

  it("최근 4주 행을 합 ÷ 합으로 계산하고 그 밖의 주는 뺀다", () => {
    const r = goalRates(
      [
        row("2026-10-26", { first_visitors: 10, first_visitors_answered: 1 }),
        row("2026-10-05", {
          first_visitors: 2,
          first_visitors_answered: 2,
          d7_cohort: 4,
          d7_returned: 1,
        }),
        row("2026-09-28", { first_visitors: 100, d7_cohort: 100 }),
      ],
      TODAY,
    );
    expect(r.firstAnswer).toEqual({ rate: 25, visitors: 12, answered: 3 });
    expect(r.d7).toEqual({ rate: 25, cohort: 4, returned: 1 });
  });
});

describe("visitFunnel·funnelSteps", () => {
  it("첫 방문 브라우저 중 체험을 마친 수만 센다", () => {
    expect(
      visitFunnel([
        { name: "first_visit", anon_id: "a" },
        { name: "first_visit", anon_id: "b" },
        { name: "trial_complete", anon_id: "a" },
        { name: "trial_complete", anon_id: "a" },
        { name: "trial_complete", anon_id: "older" },
        { name: "first_visit", anon_id: null },
      ]),
    ).toEqual({ visitors: 2, trialed: 1 });
  });

  it("앞 단계 대비 %와 첫 단계 대비 막대. 건너뛸 수 있는 단계 다음은 그 앞과 견준다", () => {
    const r = funnelSteps([
      { label: "첫 방문", n: 10 },
      { label: "체험 완료", n: 2, skippable: true },
      { label: "가입", n: 5 },
      { label: "온보딩 마침", n: 4 },
    ]);
    expect(r.map((x) => [x.base, x.ofBase, x.ofFirst])).toEqual([
      [null, null, 100],
      ["첫 방문", 20, 20],
      ["첫 방문", 50, 50],
      ["가입", 80, 40],
    ]);
  });

  it("첫 단계가 0명이면 막대는 0", () => {
    expect(funnelSteps([{ label: "가입", n: 0 }])[0].ofFirst).toBe(0);
  });
});

describe("alerts", () => {
  it("문제가 없으면 빈 목록", () => {
    expect(alerts({ rate: 5 }, "ok", { bug: 0, report: 0 })).toEqual([]);
    expect(alerts({ rate: null }, "ok", { bug: 0, report: 0 })).toEqual([]);
  });

  it("실패율 5%는 경고가 아니고 넘으면 경고", () => {
    expect(alerts({ rate: 6 }, "ok", { bug: 0, report: 0 })).toEqual([
      { label: "채점", text: "최근 7일 채점 실패가 6%예요", href: "#ops" },
    ]);
  });

  it("예산 멈춤 → 채점 실패 → 예산 80% → 버그 → 신고 순서", () => {
    expect(
      alerts({ rate: 9 }, "exceeded", { bug: 2, report: 1 }).map((a) => a.text),
    ).toEqual([
      "이번 달 AI 예산을 다 써서 오늘의 질문까지 새로 시작할 수 없어요",
      "최근 7일 채점 실패가 9%예요",
      "최근 7일 버그 피드백 2개",
      "최근 7일 신고 피드백 1개",
    ]);
    const down = alerts({ rate: 0 }, "downgrade", { bug: 0, report: 3 });
    expect(down.map((a) => a.label)).toEqual(["예산", "피드백"]);
    expect(down[1].href).toBe("/admin/feedback?category=report");
  });
});

describe("monthForecast·latency·thumbsDownQuestions·numericDate", () => {
  it("월말 예상은 3일째부터, 지금까지 쓴 돈 ÷ 지난 날 × 그달 날 수", () => {
    expect(monthForecast(3, "2026-10-02")).toBeNull();
    expect(monthForecast(3, "2026-10-03")).toBe(31);
    expect(monthForecast(1, "2026-02-14")).toBe(2);
  });

  it("지연 중간값·95번째", () => {
    expect(latency([])).toBeNull();
    const ms = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
    expect(latency(ms)).toEqual({ p50: 1000, p95: 1900, n: 20 });
    expect(latency([700])).toEqual({ p50: 700, p95: 700, n: 1 });
  });

  it("싫어요가 많은 질문 순, 같으면 평가가 많은 쪽", () => {
    const r = thumbsDownQuestions(
      [
        answer("a", TODAY, { questionId: 1, rating: -1 }),
        answer("a", TODAY, { questionId: 2, rating: -1 }),
        answer("a", TODAY, { questionId: 2, rating: 1, idx: 1 }),
        answer("a", TODAY, { questionId: 3, rating: 1 }),
        answer("a", TODAY, { questionId: 4, rating: -1 }),
        answer("a", TODAY, { questionId: 4, rating: -1, idx: 1 }),
      ],
      2,
    );
    expect(r).toEqual([
      { questionId: 4, down: 2, rated: 2 },
      { questionId: 2, down: 1, rated: 2 },
    ]);
  });

  it("받은 날은 한국 날짜 숫자형", () => {
    expect(numericDate("2026-10-27T15:30:00Z")).toBe("2026.10.28");
  });
});
