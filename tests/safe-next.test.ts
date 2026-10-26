import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-next";

describe("로그인 뒤 돌아갈 주소", () => {
  it("같은 사이트 경로는 그대로 쓴다", () => {
    expect(safeNextPath("/review")).toBe("/review");
    expect(safeNextPath("/history?tab=bookmark#q1")).toBe(
      "/history?tab=bookmark#q1",
    );
    expect(safeNextPath("/my/delete")).toBe("/my/delete");
  });

  it("값이 없으면 홈으로 간다", () => {
    expect(safeNextPath(null)).toBe("/home");
    expect(safeNextPath(undefined)).toBe("/home");
    expect(safeNextPath("")).toBe("/home");
  });

  it.each([
    "https://evil.com",
    "http://evil.com/home",
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "%2F%2Fevil.com",
    "javascript:alert(1)",
    "home",
  ])("다른 사이트로 가는 값 %j는 홈으로 바꾼다", (next) => {
    expect(safeNextPath(next)).toBe("/home");
  });

  it("인코딩한 슬래시는 경로로만 남아 다른 사이트로 가지 않는다", () => {
    expect(safeNextPath("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
    expect(safeNextPath("/%5Cevil.com")).toBe("/%5Cevil.com");
  });
});
