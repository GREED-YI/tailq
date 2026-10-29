import { describe, expect, it } from "vitest";
import { pickPrevious, scoreChange } from "@/lib/previous";

const main = (over: object = {}) => ({
  idx: 0,
  status: "graded",
  answer: "프로세스는 자원 할당 단위예요",
  score: 62,
  verdict: null,
  feedback: { summary: "문맥 전환 비용이 빠졌어요", good: [], improve: [] },
  ...over,
});
const session = (
  id: string,
  day: string,
  turns = [main()],
  status = "done",
) => ({
  id,
  day,
  status,
  turns,
});

describe("pickPrevious", () => {
  it("가장 최근의 채점된 본 질문을 답·점수·한 줄 평으로 고른다", () => {
    expect(
      pickPrevious(
        [
          session("b", "2026-10-22"),
          session("a", "2026-10-15", [main({ score: 40 })]),
        ],
        "today",
      ),
    ).toEqual({
      day: "2026-10-22",
      score: 62,
      answer: "프로세스는 자원 할당 단위예요",
      summary: "문맥 전환 비용이 빠졌어요",
    });
  });

  it("오늘 세션은 빼고 그 전 기록을 쓴다", () => {
    expect(
      pickPrevious(
        [session("today", "2026-10-29"), session("a", "2026-10-22")],
        "today",
      )?.day,
    ).toBe("2026-10-22");
  });

  it("채점이 안 된 세션과 끝나지 않은 세션은 건너뛴다", () => {
    expect(
      pickPrevious(
        [
          session("c", "2026-10-26", [main({ status: "failed", score: null })]),
          session("b", "2026-10-24", [main()], "expired"),
          session("a", "2026-10-20", [main({ score: 50 })]),
        ],
        "today",
      ),
    ).toMatchObject({ day: "2026-10-20", score: 50 });
  });

  it("꼬리질문 턴은 쓰지 않는다", () => {
    expect(
      pickPrevious(
        [
          session("b", "2026-10-24", [
            main({ status: "answering", score: null }),
            main({ idx: 1, score: null, verdict: "good" }),
          ]),
        ],
        "today",
      ),
    ).toBeNull();
  });

  it("모르겠어요는 점수 0이 아니라 null이고 답·평도 없다", () => {
    expect(
      pickPrevious(
        [
          session("a", "2026-10-22", [
            main({
              score: 0,
              verdict: "unknown",
              answer: null,
              feedback: null,
            }),
          ]),
        ],
        "today",
      ),
    ).toEqual({ day: "2026-10-22", score: null, answer: null, summary: null });
  });

  it("기록이 없으면 null(새 질문)", () => {
    expect(pickPrevious([], "today")).toBeNull();
    expect(pickPrevious([session("today", "2026-10-29")], "today")).toBeNull();
  });
});

describe("scoreChange", () => {
  it("오르면 +, text 톤", () => {
    expect(scoreChange(62, 74)).toEqual({
      delta: "+12",
      tone: "up",
      sr: "지난번 62점, 오늘 74점이에요. 12점 올랐어요.",
    });
  });
  it("같으면 ±0, muted 톤", () => {
    expect(scoreChange(62, 62)).toEqual({
      delta: "±0",
      tone: "same",
      sr: "지난번과 같은 62점이에요.",
    });
  });
  it("내리면 ASCII 하이픈, sub 톤", () => {
    expect(scoreChange(62, 58)).toEqual({
      delta: "-4",
      tone: "down",
      sr: "지난번 62점, 오늘 58점이에요. 4점 내려갔어요.",
    });
  });
  it("한쪽이 모르겠어요면 변화량이 없다", () => {
    expect(scoreChange(null, 74)).toEqual({
      delta: null,
      tone: null,
      sr: "지난번엔 모르겠어요, 오늘은 74점이에요.",
    });
    expect(scoreChange(62, null)).toMatchObject({
      delta: null,
      sr: "지난번 62점, 오늘은 모르겠어요를 골랐어요.",
    });
    expect(scoreChange(null, null).delta).toBeNull();
  });
  it("채점 중이면 지난번만 읽는다", () => {
    expect(scoreChange(62, undefined)).toEqual({
      delta: null,
      tone: null,
      sr: "지난번 62점이었어요.",
    });
  });
});
