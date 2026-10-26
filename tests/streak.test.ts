import { describe, expect, it } from "vitest";
import {
  addDays,
  computeStreak,
  grassCells,
  grassLevel,
  grassStart,
  studyDay,
  weekStart,
} from "@/lib/streak";

// 2026-10-26은 월요일
const MON = "2026-10-26";
// from부터 n일 연속
const run = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) => addDays(from, i));

describe("weekStart", () => {
  it("월~일을 한 주로 보고 그 주의 월요일을 돌려준다", () => {
    expect(weekStart(MON)).toBe(MON);
    expect(weekStart("2026-10-28")).toBe(MON);
    expect(weekStart("2026-11-01")).toBe(MON); // 일요일
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
    expect(weekStart("2027-01-01")).toBe("2026-12-28"); // 해를 넘는 주
  });
});

describe("studyDay", () => {
  it("제출 시각을 한국 시간 자정 기준 날짜로 바꾼다", () => {
    expect(studyDay("2026-10-25T14:59:59.999Z")).toBe("2026-10-25");
    expect(studyDay("2026-10-25T15:00:00Z")).toBe("2026-10-26");
    expect(studyDay("2026-10-26T00:00:00+09:00")).toBe("2026-10-26");
    expect(studyDay("2026-10-26T23:59:59+09:00")).toBe("2026-10-26");
    expect(studyDay("2026-12-31T15:00:00+00:00")).toBe("2027-01-01");
  });
});

describe("computeStreak", () => {
  it("학습한 날이 없으면 0", () => {
    expect(computeStreak([], MON)).toEqual({
      current: 0,
      longest: 0,
      restDays: [],
    });
  });

  it("오늘까지 이어 푼 날 수를 센다", () => {
    const s = computeStreak(run("2026-10-20", 7), MON);
    expect(s.current).toBe(7);
    expect(s.longest).toBe(7);
    expect(s.restDays).toEqual([]);
  });

  it("오늘 아직 안 풀었으면 어제까지로 이어진다", () => {
    const s = computeStreak(run("2026-10-20", 6), MON);
    expect(s.current).toBe(6);
    expect(s.restDays).toEqual([]);
  });

  it("하루 빈 날은 그 주의 휴식권으로 메우고, 휴식일은 세지 않는다", () => {
    // 수(28) 빠짐
    const days = ["2026-10-26", "2026-10-27", "2026-10-29", "2026-10-30"];
    const s = computeStreak(days, "2026-10-30");
    expect(s.current).toBe(4);
    expect(s.restDays).toEqual(["2026-10-28"]);
  });

  it("이틀 연속 비면 끊긴다", () => {
    const days = ["2026-10-26", "2026-10-27", "2026-10-30"];
    const s = computeStreak(days, "2026-10-30");
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
    expect(s.restDays).toEqual([]);
  });

  it("휴식권은 한 주에 한 번만 쓴다", () => {
    // 화(27)·목(29) 빠짐. 화는 휴식권, 목은 그 주 휴식권이 없어 끊긴다
    const days = ["2026-10-26", "2026-10-28", "2026-10-30", "2026-10-31"];
    const s = computeStreak(days, "2026-10-31");
    expect(s.restDays).toEqual(["2026-10-27"]);
    expect(s.current).toBe(2);
    expect(s.longest).toBe(2);
  });

  it("휴식권은 월요일에 다시 채워진다", () => {
    // 일(11-01)과 다음 주 화(11-03)가 빠짐. 서로 다른 주라 둘 다 메운다
    const days = [
      ...run("2026-10-26", 6),
      "2026-11-02",
      ...run("2026-11-04", 2),
    ];
    const s = computeStreak(days, "2026-11-05");
    expect(s.restDays).toEqual(["2026-11-01", "2026-11-03"]);
    expect(s.current).toBe(9);
  });

  it("일요일과 월요일이 이어서 비면 주가 달라도 이틀 빈 것이라 끊긴다", () => {
    const days = [...run("2026-10-26", 6), "2026-11-03"];
    const s = computeStreak(days, "2026-11-03");
    expect(s.current).toBe(1);
    expect(s.restDays).toEqual([]);
  });

  it("어제가 비었으면 오늘 풀 것을 기대해 휴식권을 써서 이어 둔다", () => {
    // 오늘 수(28), 어제 화(27) 빠짐
    const s = computeStreak(["2026-10-25", "2026-10-26"], "2026-10-28");
    expect(s.current).toBe(2);
    expect(s.restDays).toEqual(["2026-10-27"]);
  });

  it("어제가 비었는데 이번 주 휴식권을 이미 썼으면 끊긴다", () => {
    // 화(27)에 휴식권을 썼고, 오늘은 금(30)인데 어제 목(29)이 빠짐
    const days = ["2026-10-26", "2026-10-28"];
    const s = computeStreak(days, "2026-10-30");
    expect(s.restDays).toEqual(["2026-10-27"]);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(2);
  });

  it("이틀 전이 마지막이고 어제·오늘 다 안 풀었으면 0", () => {
    const s = computeStreak(run("2026-10-20", 4), MON);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(4);
    expect(s.restDays).toEqual([]);
  });

  it("가장 긴 꼬리잇기를 지난 기록에서 찾는다", () => {
    const days = [...run("2026-09-01", 10), ...run("2026-10-25", 2)];
    const s = computeStreak(days, MON);
    expect(s.current).toBe(2);
    expect(s.longest).toBe(10);
  });

  it("같은 날 중복과 오늘 뒤 날짜는 무시하고 순서와 상관없다", () => {
    const days = ["2026-10-26", "2026-10-25", "2026-10-26", "2026-10-27"];
    expect(computeStreak(days, MON).current).toBe(2);
  });
});

describe("grassLevel", () => {
  it("점수 구간으로 1~4단계를 정한다", () => {
    expect(grassLevel(null)).toBe(1);
    expect(grassLevel(0)).toBe(1);
    expect(grassLevel(39)).toBe(1);
    expect(grassLevel(40)).toBe(2);
    expect(grassLevel(69)).toBe(2);
    expect(grassLevel(70)).toBe(3);
    expect(grassLevel(89)).toBe(3);
    expect(grassLevel(90)).toBe(4);
    expect(grassLevel(100)).toBe(4);
  });
});

describe("grassCells", () => {
  const today = "2026-10-28"; // 수요일
  const scores = new Map<string, number | null>([
    ["2026-10-26", 95],
    ["2026-10-28", null],
    ["2025-11-03", 50],
  ]);
  const cells = grassCells(scores, ["2026-10-27"], today);

  it("이번 주를 포함한 52주를 월요일부터 채운다", () => {
    expect(cells).toHaveLength(52 * 7);
    expect(cells[0].day).toBe(grassStart(today));
    expect(cells[0].day).toBe("2025-11-03");
    expect(weekStart(cells[0].day)).toBe(cells[0].day);
    expect(cells.at(-1)!.day).toBe("2026-11-01");
  });

  it("학습한 날은 점수 단계, 휴식권 쓴 날은 rest, 오늘 뒤는 future", () => {
    const byDay = new Map(cells.map((c) => [c.day, c]));
    expect(byDay.get("2025-11-03")!.level).toBe(2);
    expect(byDay.get("2026-10-26")).toMatchObject({ level: 4, score: 95 });
    expect(byDay.get("2026-10-27")).toMatchObject({ level: 0, rest: true });
    expect(byDay.get("2026-10-28")).toMatchObject({
      level: 1,
      score: null,
      future: false,
    });
    expect(byDay.get("2026-10-29")!.future).toBe(true);
    expect(cells.filter((c) => c.level > 0)).toHaveLength(3);
  });
});
