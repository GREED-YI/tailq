import { describe, expect, it } from "vitest";
import { dayLabel, homeState } from "@/lib/home";

describe("homeState", () => {
  it("본 질문에 아직 답하지 않았으면 오늘 안 풂", () => {
    expect(homeState("open", [{ idx: 0, status: "answering" }])).toEqual({
      kind: "todo",
    });
    expect(homeState("open", [])).toEqual({ kind: "todo" });
  });

  it("본 질문을 냈거나 꼬리질문 중이면 하던 중", () => {
    expect(homeState("open", [{ idx: 0, status: "failed" }])).toEqual({
      kind: "doing",
      step: 0,
    });
    expect(
      homeState("open", [
        { idx: 0, status: "graded" },
        { idx: 1, status: "graded" },
        { idx: 2, status: "answering" },
      ]),
    ).toEqual({ kind: "doing", step: 2 });
  });

  it("세션이 끝났으면 오늘 완료", () => {
    expect(homeState("done", [{ idx: 0, status: "graded" }])).toEqual({
      kind: "done",
    });
  });
});

describe("dayLabel", () => {
  it("날짜와 영어 요일 세 글자", () => {
    expect(dayLabel("2026-10-22")).toBe("2026.10.22 THU");
    expect(dayLabel("2026-10-26")).toBe("2026.10.26 MON");
  });
});
