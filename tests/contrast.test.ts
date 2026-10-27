import { describe, expect, it } from "vitest";
import { contrast, over } from "@/lib/contrast";
import { ADMIN_TOKENS, TOKENS } from "@/lib/theme";

// 유리 위 글자 대비 4.5:1 이상(#25 완료 조건, docs/07 접근성)
// 운영 화면(#104)은 기본 토큰 위에 남색 값을 덮어쓴다
const themes = [
  ["dark", TOKENS.dark],
  ["light", TOKENS.light],
  ["운영 dark", { ...TOKENS.dark, ...ADMIN_TOKENS.dark }],
  ["운영 light", { ...TOKENS.light, ...ADMIN_TOKENS.light }],
] as const;

describe.each(themes)("%s 테마 대비", (_, t) => {
  const glass = over(t.glass, t.bg);
  const sheet = over(t.sheet, t.bg);

  it.each(["text", "sub", "muted", "accent"] as const)(
    "유리 위 %s 글자가 4.5:1 이상",
    (key) => {
      expect(contrast(t[key], glass)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t[key], sheet)).toBeGreaterThanOrEqual(4.5);
    },
  );

  // 행·메뉴·유리 버튼 hover는 유리 위에 hover 면을 한 겹 더 얹는다
  it.each(["text", "sub", "accent"] as const)(
    "hover 면 위 %s 글자가 4.5:1 이상",
    (key) => {
      expect(contrast(t[key], over(t.hover, glass))).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );

  // 점수 숫자·막대도 글자처럼 읽히므로 같은 기준. 구간끼리는 서로 다른 색이어야 한다
  it.each(["good", "mid", "low"] as const)(
    "유리 위 점수 %s 색이 4.5:1 이상",
    (key) => {
      expect(contrast(t[key], glass)).toBeGreaterThanOrEqual(4.5);
    },
  );
  it("점수 구간 색 셋이 모두 다르다", () => {
    expect(new Set([t.good, t.mid, t.low]).size).toBe(3);
  });

  it("주 버튼 글자가 4.5:1 이상", () => {
    expect(contrast(t["on-accent"], t["accent-fill"])).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("삭제·탈퇴 버튼 흰 글씨가 4.5:1 이상", () => {
    expect(contrast(t["on-danger"], t["danger-fill"])).toBeGreaterThanOrEqual(
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
