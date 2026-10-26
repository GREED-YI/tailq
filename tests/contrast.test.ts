import { describe, expect, it } from "vitest";
import { contrast, over } from "@/lib/contrast";
import { TOKENS } from "@/lib/theme";

// 유리 위 글자 대비 4.5:1 이상(#25 완료 조건, docs/07 접근성)
describe.each(["dark", "light"] as const)("%s 테마 대비", (name) => {
  const t = TOKENS[name];
  const glass = over(t.glass, t.bg);
  const sheet = over(t.sheet, t.bg);

  it.each(["text", "sub", "muted", "accent"] as const)(
    "유리 위 %s 글자가 4.5:1 이상",
    (key) => {
      expect(contrast(t[key], glass)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t[key], sheet)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("주 버튼 글자가 4.5:1 이상", () => {
    expect(contrast(t["on-accent"], t["accent-fill"])).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

describe("대비 계산", () => {
  it("검정과 흰색은 21:1", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });
  it("반투명 색을 배경에 겹친다", () => {
    expect(over("rgba(255,255,255,0.5)", "#000000")).toBe("rgb(128,128,128)");
  });
});
