import { describe, expect, it } from "vitest";
import {
  answersSince,
  isAdmin,
  opsStats,
  type Answer,
  type Signup,
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
    expect(r.users).toEqual({ total: 0, newThisWeek: 0, onboardRate: null });
    expect(r.d7).toEqual({ rate: null, cohort: 0 });
    expect(r.thumbsUp.rate).toBeNull();
    expect(r.failRate).toBeNull();
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
    expect(r.lastWeek).toBe(1);
    expect(r.activeThisWeek).toBe(2);
    expect(r.weekly[0].week).toBe(answersSince(TODAY));
  });

  it("가입·온보딩은 전체에서, 이번 주 가입은 월요일부터 센다", () => {
    const r = opsStats(
      [
        signup("a", "2026-10-25"),
        signup("b", "2026-10-26", false),
        signup("c", "2026-10-28"),
        signup("d", "2026-10-01"),
      ],
      [],
      TODAY,
    );
    expect(r.users).toEqual({ total: 4, newThisWeek: 2, onboardRate: 75 });
  });

  it("D7은 가입 7~35일 된 사람 중 가입 다음 날부터 7일 안에 다시 답한 비율", () => {
    const r = opsStats(
      [
        signup("back", "2026-10-10"),
        signup("sameDay", "2026-10-10"),
        signup("late", "2026-10-10"),
        signup("tooNew", "2026-10-25"),
        signup("tooOld", "2026-09-01"),
      ],
      [
        answer("back", "2026-10-17"),
        answer("sameDay", "2026-10-10"),
        answer("late", "2026-10-18"),
      ],
      TODAY,
    );
    expect(r.d7).toEqual({ rate: 33, cohort: 3 });
  });

  it("👍 비율·채점 실패율·점수 분포·꼬리질문 판정을 센다", () => {
    const r = opsStats(
      [],
      [
        answer("a", TODAY, { score: 100, rating: 1 }),
        answer("a", TODAY, { score: 0, rating: -1 }),
        answer("a", TODAY, { score: 45, rating: 1 }),
        answer("a", TODAY, { status: "failed", score: null }),
        answer("a", TODAY, { idx: 1, score: null, verdict: "good" }),
        answer("a", TODAY, { idx: 2, score: null, verdict: "unknown" }),
      ],
      TODAY,
    );
    expect(r.thumbsUp).toEqual({ rate: 67, count: 3 });
    expect(r.failRate).toBe(17);
    expect(r.average).toBe(48);
    expect(r.scoreBands).toEqual([1, 0, 1, 0, 1]);
    expect(r.verdicts).toEqual({ good: 1, unknown: 1 });
  });
});
