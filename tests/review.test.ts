import { describe, expect, it } from "vitest";
import {
  daysUntil,
  dueLabel,
  inQuestionFilter,
  matchesFilter,
  questionFilter,
  type QuestionFilter,
} from "@/lib/review";

const today = "2026-10-26";

describe("daysUntil", () => {
  it("다음 복습일까지 남은 날 수를 센다", () => {
    expect(daysUntil("2026-10-26", today)).toBe(0);
    expect(daysUntil("2026-10-27", today)).toBe(1);
    expect(daysUntil("2026-11-25", today)).toBe(30);
    expect(daysUntil("2026-10-24", today)).toBe(-2);
  });
});

describe("dueLabel", () => {
  it("밀린 질문도 오늘 다시", () => {
    expect(dueLabel(-3)).toBe("오늘 다시");
    expect(dueLabel(0)).toBe("오늘 다시");
    expect(dueLabel(1)).toBe("내일 다시");
    expect(dueLabel(7)).toBe("7일 뒤 다시");
  });
});

describe("matchesFilter", () => {
  const overdue = { box: 1, dueDay: "2026-10-24" };
  const due = { box: 2, dueDay: "2026-10-26" };
  const sixDays = { box: 3, dueDay: "2026-11-01" };
  const sevenDays = { box: 3, dueDay: "2026-11-02" };
  const mastered = { box: null, dueDay: "2026-10-20" };
  const pick = (filter: Parameters<typeof matchesFilter>[1]) =>
    [overdue, due, sixDays, sevenDays, mastered].filter((r) =>
      matchesFilter(r, filter, today),
    );

  it("전체는 복습 중인 질문만", () => {
    expect(pick("all")).toEqual([overdue, due, sixDays, sevenDays]);
  });

  it("오늘은 오늘과 밀린 질문", () => {
    expect(pick("today")).toEqual([overdue, due]);
  });

  it("이번 주는 오늘부터 7일 안", () => {
    expect(pick("week")).toEqual([overdue, due, sixDays]);
  });

  it("익힌 질문은 칸이 없는 질문", () => {
    expect(pick("mastered")).toEqual([mastered]);
  });
});

describe("inQuestionFilter", () => {
  const overdue = { box: 1, dueDay: "2026-10-24", bookmarked: false };
  const sixDays = { box: 3, dueDay: "2026-11-01", bookmarked: true };
  const sevenDays = { box: 3, dueDay: "2026-11-02", bookmarked: false };
  const mastered = { box: null, dueDay: "2026-10-20", bookmarked: true };
  // 복습 정보가 없거나 숨긴 질문
  const noReview = { box: null, dueDay: null, bookmarked: true };
  const all = [overdue, sixDays, sevenDays, mastered, noReview];
  const pick = (f: QuestionFilter) =>
    all.filter((r) => inQuestionFilter(r, f, today));

  it("오늘 복습은 오늘과 밀린 질문", () => {
    expect(pick("today")).toEqual([overdue]);
  });

  it("이번 주는 오늘부터 7일 안", () => {
    expect(pick("week")).toEqual([overdue, sixDays]);
  });

  it("북마크는 복습 정보와 상관없이 별표한 질문", () => {
    expect(pick("bookmark")).toEqual([sixDays, mastered, noReview]);
  });

  it("복습 완료는 칸이 없는 질문이고, 복습 정보가 없는 질문은 빠진다", () => {
    expect(pick("mastered")).toEqual([mastered]);
  });

  it("전체는 모두", () => {
    expect(pick("all")).toEqual(all);
  });
});

describe("questionFilter", () => {
  const due = { box: 1, dueDay: "2026-10-26", bookmarked: false };
  const later = { box: 2, dueDay: "2026-10-30", bookmarked: false };

  it("알맞은 값은 그대로", () => {
    expect(questionFilter("bookmark", [due], today)).toBe("bookmark");
    expect(questionFilter("all", [due], today)).toBe("all");
  });

  it("값이 없거나 틀리면 오늘 복습이 있을 때 today, 없으면 all", () => {
    expect(questionFilter(undefined, [later, due], today)).toBe("today");
    expect(questionFilter("nope", [later], today)).toBe("all");
    expect(questionFilter(["today"], [], today)).toBe("all");
  });
});
