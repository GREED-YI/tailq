import { describe, expect, it } from "vitest";
import { contrast, over } from "@/lib/contrast";
import { ADMIN_TOKENS, TOKENS } from "@/lib/theme";

// DESIGN.md "Contrast pairs". 운영 화면은 기본 토큰 위에 강조색만 덮어쓴다
const themes = [
  ["dark", TOKENS.dark],
  ["light", TOKENS.light],
  ["운영 dark", { ...TOKENS.dark, ...ADMIN_TOKENS.dark }],
  ["운영 light", { ...TOKENS.light, ...ADMIN_TOKENS.light }],
] as const;

type Key = keyof typeof TOKENS.dark;
const TEXT_PAIRS: [Key, Key][] = [
  ["text", "canvas"],
  ["text-sub", "canvas"],
  ["text-muted", "canvas"],
  ["text-muted", "surface"],
  ["on-primary", "primary"],
  ["accent", "canvas"],
  ["accent", "accent-soft"],
  // 오류 글자와 danger-ghost 링크(탈퇴하기·프로젝트 삭제하기)
  ["danger", "canvas"],
  ["danger", "surface"],
  ["on-danger", "danger-fill"],
];
// 빈 칸·빈 날·남은 단계 테두리, 로고 Q 꼬리는 그래픽 대비 3:1
const MARK_PAIRS: [Key, Key][] = [
  ["mark-empty", "canvas"],
  ["mark-empty", "surface"],
  ["brand-tail", "canvas"],
  ["brand-tail", "surface"],
];

describe.each(themes)("%s 테마 대비", (_, t) => {
  it.each(TEXT_PAIRS)("%s on %s가 4.5:1 이상", (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(MARK_PAIRS)("%s on %s가 3:1 이상", (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
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
