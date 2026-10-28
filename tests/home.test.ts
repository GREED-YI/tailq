import { describe, expect, it } from "vitest";
import { HOME_GUIDE_KEY, homeGuideScript, homeState } from "@/lib/home";

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

describe("homeGuideScript", () => {
  // 첫 그림 전 스크립트를 가짜 저장소·문서로 돌려 html에 붙는 표시를 본다
  function run(getItem: (k: string) => string | null) {
    const dataset: Record<string, string> = {};
    new Function("localStorage", "document", homeGuideScript)(
      { getItem },
      { documentElement: { dataset } },
    );
    return dataset.homeGuide;
  }

  it("닫은 브라우저만 숨긴다", () => {
    expect(run((k) => (k === HOME_GUIDE_KEY ? "1" : null))).toBe("closed");
    expect(run(() => null)).toBeUndefined();
  });

  it("저장소를 못 읽으면 안내를 보여준다", () => {
    expect(
      run(() => {
        throw new Error("blocked");
      }),
    ).toBeUndefined();
  });
});
