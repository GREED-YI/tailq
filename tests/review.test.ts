import { describe, expect, it } from "vitest";
import { daysUntil, dueLabel, matchesFilter } from "@/lib/review";

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
