import { describe, expect, it } from "vitest";
import { kstDay, pickDailyQuestion, type PickInput } from "@/lib/daily-pick";

const bank = [
  { id: 1, topicId: "jpa", level: "basic" },
  { id: 2, topicId: "jpa", level: "mid" },
  { id: 3, topicId: "react", level: "basic" },
  { id: 4, topicId: "react", level: "deep" },
  { id: 5, topicId: "network", level: "mid" },
  { id: 6, topicId: "network", level: "basic" },
];

const input = (over: Partial<PickInput> = {}): PickInput => ({
  today: "2026-10-26",
  topics: ["jpa", "react", "network"],
  levels: [],
  bank,
  reviews: [],
  sessions: [],
  ...over,
});

describe("kstDay", () => {
  it("한국 시간 자정에 날짜가 바뀐다", () => {
    expect(kstDay(new Date("2026-10-25T14:59:59.999Z"))).toBe("2026-10-25");
    expect(kstDay(new Date("2026-10-25T15:00:00.000Z"))).toBe("2026-10-26");
  });

  it("UTC로는 같은 날이어도 한국 시간으로 나눈다", () => {
    expect(kstDay(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01-01");
  });
});

describe("복습 질문", () => {
  it("복습일이 된 질문을 새 질문보다 먼저 낸다", () => {
    const r = pickDailyQuestion(
      input({ reviews: [{ questionId: 2, dueDay: "2026-10-26" }] }),
    );
    expect(r).toEqual({ pick: "review", questionId: 2 });
  });

  it("가장 오래 밀린 것부터, 같은 날이면 번호 순서로 낸다", () => {
    const r = pickDailyQuestion(
      input({
        reviews: [
          { questionId: 5, dueDay: "2026-10-25" },
          { questionId: 4, dueDay: "2026-10-20" },
          { questionId: 3, dueDay: "2026-10-20" },
        ],
      }),
    );
    expect(r).toEqual({ pick: "review", questionId: 3 });
  });

  it("복습일이 아직이면 새 질문을 낸다", () => {
    const r = pickDailyQuestion(
      input({ reviews: [{ questionId: 2, dueDay: "2026-10-27" }] }),
    );
    expect(r.pick).toBe("new");
  });

  it("범위 밖 주제의 복습도 낸다", () => {
    const r = pickDailyQuestion(
      input({
        topics: ["jpa"],
        reviews: [{ questionId: 4, dueDay: "2026-10-26" }],
      }),
    );
    expect(r).toEqual({ pick: "review", questionId: 4 });
  });
});

describe("새 질문", () => {
  it("연습 범위의 주제와 난이도 안에서 고른다", () => {
    const r = pickDailyQuestion(input({ topics: ["react"], levels: ["deep"] }));
    expect(r).toEqual({ pick: "new", questionId: 4 });
  });

  it("난이도를 고르지 않았으면 모든 난이도에서 고른다", () => {
    const r = pickDailyQuestion(input({ topics: ["jpa"], levels: [] }));
    expect(r).toEqual({ pick: "new", questionId: 1 });
  });

  it("본 질문을 낸 질문과 복습 중인 질문은 다시 새 질문으로 내지 않는다", () => {
    const r = pickDailyQuestion(
      input({
        topics: ["jpa"],
        sessions: [
          { questionId: 1, topicId: "jpa", day: "2026-10-01", answered: true },
        ],
        reviews: [{ questionId: 2, dueDay: "2026-11-30" }],
      }),
    );
    // jpa의 두 질문이 모두 빠져 새 질문이 없으니 복습을 앞당긴다
    expect(r).toEqual({ pick: "advance", questionId: 2 });
  });

  it("최근에 나온 주제를 피하고 가장 오래전에 나온 주제에서 고른다", () => {
    const r = pickDailyQuestion(
      input({
        sessions: [
          { questionId: 1, topicId: "jpa", day: "2026-10-25", answered: true },
          {
            questionId: 3,
            topicId: "react",
            day: "2026-10-23",
            answered: true,
          },
          {
            questionId: 5,
            topicId: "network",
            day: "2026-10-24",
            answered: true,
          },
        ],
      }),
    );
    expect(r).toEqual({ pick: "new", questionId: 4 });
  });

  it("한 번도 안 나온 주제를 먼저 고른다", () => {
    const r = pickDailyQuestion(
      input({
        sessions: [
          { questionId: 1, topicId: "jpa", day: "2026-10-20", answered: true },
          {
            questionId: 3,
            topicId: "react",
            day: "2026-10-21",
            answered: true,
          },
        ],
      }),
    );
    expect(r).toEqual({ pick: "new", questionId: 5 });
  });

  it("매일 풀면 주제가 고르게 돈다", () => {
    const sessions: PickInput["sessions"] = [];
    const topics: string[] = [];
    for (let d = 20; d <= 25; d++) {
      const today = `2026-10-${d}`;
      const r = pickDailyQuestion(input({ today, sessions }));
      if (r.pick !== "new") throw new Error("새 질문이 나와야 한다");
      const topicId = bank.find((q) => q.id === r.questionId)!.topicId;
      topics.push(topicId);
      sessions.push({
        questionId: r.questionId,
        topicId,
        day: today,
        answered: true,
      });
    }
    expect(topics).toEqual([
      "jpa",
      "react",
      "network",
      "jpa",
      "react",
      "network",
    ]);
  });
});

describe("놓친 날", () => {
  it("어제 놓친 새 질문을 이어서 내지 않고, 다른 주제의 새 질문을 낸다", () => {
    const r = pickDailyQuestion(
      input({
        sessions: [
          { questionId: 1, topicId: "jpa", day: "2026-10-25", answered: false },
        ],
      }),
    );
    expect(r).toEqual({ pick: "new", questionId: 3 });
  });

  it("놓친 새 질문은 푼 것이 아니라 나중에 다시 나올 수 있다", () => {
    const r = pickDailyQuestion(
      input({
        topics: ["jpa"],
        levels: ["basic"],
        sessions: [
          { questionId: 1, topicId: "jpa", day: "2026-10-20", answered: false },
        ],
      }),
    );
    expect(r).toEqual({ pick: "new", questionId: 1 });
  });

  it("며칠 비워도 밀린 복습 질문은 사라지지 않고 다시 나온다", () => {
    const r = pickDailyQuestion(
      input({
        today: "2026-11-05",
        reviews: [{ questionId: 6, dueDay: "2026-10-27" }],
        sessions: [
          {
            questionId: 6,
            topicId: "network",
            day: "2026-10-26",
            answered: false,
          },
        ],
      }),
    );
    expect(r).toEqual({ pick: "review", questionId: 6 });
  });
});

describe("범위 소진", () => {
  const allSolved = bank.map((q) => ({
    questionId: q.id,
    topicId: q.topicId,
    day: "2026-10-01",
    answered: true,
  }));

  it("새 질문이 없으면 가장 가까운 복습 예정 질문을 앞당긴다", () => {
    const r = pickDailyQuestion(
      input({
        sessions: allSolved,
        reviews: [
          { questionId: 2, dueDay: "2026-11-10" },
          { questionId: 5, dueDay: "2026-10-28" },
        ],
      }),
    );
    expect(r).toEqual({ pick: "advance", questionId: 5 });
  });

  it("앞당길 복습도 없으면 낼 질문이 없다", () => {
    expect(pickDailyQuestion(input({ sessions: allSolved }))).toEqual({
      pick: null,
    });
  });

  it("연습 범위가 비어 있으면 낼 질문이 없다", () => {
    expect(pickDailyQuestion(input({ topics: [] }))).toEqual({ pick: null });
  });
});

describe("같은 질문·복습 이어짐 막기", () => {
  // n일 전 오늘의 질문 세션(오늘은 2026-10-26)
  const daily = (
    n: number,
    pick: "review" | "new" | "advance",
    questionId: number,
  ) => ({
    questionId,
    topicId: bank.find((q) => q.id === questionId)!.topicId,
    day: `2026-10-${26 - n}`,
    answered: true,
    pick,
  });

  it("처음 쓰는 날(지난 세션 없음)은 지금처럼 복습을 먼저 낸다", () => {
    const r = pickDailyQuestion(
      input({ reviews: [{ questionId: 2, dueDay: "2026-10-26" }] }),
    );
    expect(r).toEqual({ pick: "review", questionId: 2 });
  });

  it("어제 낸 질문이 다시 복습일이어도 오늘은 다른 복습을 낸다", () => {
    const r = pickDailyQuestion(
      input({
        reviews: [
          { questionId: 2, dueDay: "2026-10-26" },
          { questionId: 5, dueDay: "2026-10-26" },
        ],
        sessions: [daily(1, "review", 2)],
      }),
    );
    expect(r).toEqual({ pick: "review", questionId: 5 });
  });

  it("어제 낸 질문만 복습일이면 새 질문을 낸다", () => {
    const r = pickDailyQuestion(
      input({
        reviews: [{ questionId: 2, dueDay: "2026-10-25" }],
        sessions: [daily(1, "review", 2)],
      }),
    );
    expect(r.pick).toBe("new");
  });

  it("어제 놓친 새 질문을 오늘 새 질문으로 다시 내지 않는다", () => {
    const r = pickDailyQuestion(
      input({
        topics: ["jpa"],
        levels: ["basic"],
        bank: [...bank, { id: 7, topicId: "jpa", level: "basic" }],
        sessions: [{ ...daily(1, "new", 1), answered: false }],
      }),
    );
    expect(r).toEqual({ pick: "new", questionId: 7 });
  });

  it("복습이 하루만이었으면 오늘도 복습을 낸다", () => {
    const r = pickDailyQuestion(
      input({
        reviews: [{ questionId: 5, dueDay: "2026-10-26" }],
        sessions: [daily(2, "new", 1), daily(1, "review", 2)],
      }),
    );
    expect(r).toEqual({ pick: "review", questionId: 5 });
  });

  it("복습이 이틀 이어졌으면 밀린 복습이 있어도 새 질문을 먼저 낸다", () => {
    const r = pickDailyQuestion(
      input({
        reviews: [{ questionId: 5, dueDay: "2026-10-20" }],
        sessions: [daily(2, "review", 1), daily(1, "review", 2)],
      }),
    );
    expect(r.pick).toBe("new");
  });

  it("새 질문을 낸 다음 날은 넘어간 복습이 다시 나온다", () => {
    const r = pickDailyQuestion(
      input({
        reviews: [{ questionId: 5, dueDay: "2026-10-20" }],
        sessions: [
          daily(3, "review", 1),
          daily(2, "review", 2),
          daily(1, "new", 3),
        ],
      }),
    );
    expect(r).toEqual({ pick: "review", questionId: 5 });
  });

  it("하루 비어 이어지지 않았으면 복습 이틀로 세지 않는다", () => {
    const r = pickDailyQuestion(
      input({
        reviews: [{ questionId: 5, dueDay: "2026-10-20" }],
        sessions: [daily(3, "review", 1), daily(1, "review", 2)],
      }),
    );
    expect(r).toEqual({ pick: "review", questionId: 5 });
  });

  it("복습이 이틀 이어졌어도 낼 새 질문이 없으면 복습을 낸다", () => {
    const r = pickDailyQuestion(
      input({
        topics: ["jpa"],
        reviews: [{ questionId: 5, dueDay: "2026-10-20" }],
        sessions: [daily(2, "review", 1), daily(1, "review", 2)],
      }),
    );
    expect(r).toEqual({ pick: "review", questionId: 5 });
  });

  it("복습만 남았고 어제 낸 질문이 복습일이면 다른 복습을 앞당긴다", () => {
    const r = pickDailyQuestion(
      input({
        topics: ["jpa"],
        reviews: [
          { questionId: 1, dueDay: "2026-10-26" },
          { questionId: 2, dueDay: "2026-11-10" },
        ],
        sessions: [daily(1, "review", 1)],
      }),
    );
    expect(r).toEqual({ pick: "advance", questionId: 2 });
  });

  it("낼 질문이 어제 낸 질문밖에 없으면 아무것도 안 내는 대신 다시 낸다", () => {
    const r = pickDailyQuestion(
      input({
        topics: ["jpa"],
        sessions: [daily(2, "new", 2), daily(1, "review", 1)],
        reviews: [{ questionId: 1, dueDay: "2026-10-26" }],
      }),
    );
    expect(r).toEqual({ pick: "review", questionId: 1 });
  });

  it("프로젝트 질문 세션(pick 없음)은 어제 낸 질문으로 보지 않는다", () => {
    const r = pickDailyQuestion(
      input({
        reviews: [{ questionId: 2, dueDay: "2026-10-26" }],
        sessions: [{ ...daily(1, "review", 2), pick: null }],
      }),
    );
    expect(r).toEqual({ pick: "review", questionId: 2 });
  });
});
