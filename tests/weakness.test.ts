import { describe, expect, it } from "vitest";
import { weaknessReport, type Attempt } from "@/lib/weakness";

// 2026-10-28은 수요일, 이번 주는 10-26(월)부터
const TODAY = "2026-10-28";
const at = (topicId: string, day: string, score: number): Attempt => ({
  topicId,
  topic: topicId.toUpperCase(),
  day,
  score,
});

describe("weaknessReport", () => {
  it("기록이 없으면 빈 리포트", () => {
    expect(weaknessReport([], TODAY)).toEqual({ topics: [], collecting: 0 });
  });

  it("3번 미만 푼 주제는 보여주지 않고 데이터가 모이는 중으로 센다", () => {
    const r = weaknessReport(
      [
        at("os", "2026-10-20", 50),
        at("os", "2026-10-21", 60),
        at("net", "2026-10-21", 30),
      ],
      TODAY,
    );
    expect(r).toEqual({ topics: [], collecting: 2 });
  });

  it("주제별 평균(반올림)을 낮은 순으로 돌려주고 모르겠어요 0점도 평균에 넣는다", () => {
    const r = weaknessReport(
      [
        at("jpa", "2026-10-01", 80),
        at("jpa", "2026-10-02", 70),
        at("jpa", "2026-10-03", 75),
        at("tx", "2026-10-01", 0),
        at("tx", "2026-10-02", 60),
        at("tx", "2026-10-03", 61),
        at("os", "2026-10-03", 40),
      ],
      TODAY,
    );
    expect(r.collecting).toBe(1);
    expect(r.topics.map((t) => [t.topicId, t.attempts, t.average])).toEqual([
      ["tx", 3, 40],
      ["jpa", 3, 75],
    ]);
    expect(r.topics[0].topic).toBe("TX");
  });

  it("지난주 대비는 지난주까지의 평균에서 지금 평균까지의 변화다", () => {
    const r = weaknessReport(
      [
        at("jpa", "2026-10-19", 60),
        at("jpa", "2026-10-25", 70), // 일요일까지 지난주
        at("jpa", "2026-10-26", 95), // 이번 주 월요일
        at("net", "2026-10-12", 50),
        at("net", "2026-10-13", 70),
        at("net", "2026-10-14", 60),
      ],
      TODAY,
    );
    const by = Object.fromEntries(r.topics.map((t) => [t.topicId, t]));
    expect(by.jpa).toMatchObject({ average: 75, change: 10 });
    // 이번 주에 안 풀었으면 같음
    expect(by.net).toMatchObject({ average: 60, change: 0 });
  });

  it("이번 주에 처음 푼 주제는 지난주 대비가 없다", () => {
    const r = weaknessReport(
      [
        at("os", "2026-10-26", 50),
        at("os", "2026-10-27", 40),
        at("os", "2026-10-28", 30),
      ],
      TODAY,
    );
    expect(r.topics[0]).toMatchObject({ average: 40, change: null });
  });

  it("평균이 같으면 이름순", () => {
    const r = weaknessReport(
      ["b", "a"].flatMap((t) => [1, 2, 3].map(() => at(t, "2026-10-01", 50))),
      TODAY,
    );
    expect(r.topics.map((t) => t.topicId)).toEqual(["a", "b"]);
  });
});
