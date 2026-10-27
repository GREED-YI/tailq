import { describe, expect, it } from "vitest";
import {
  lastSignInMs,
  needsReauth,
  REAUTH_AFTER_MS,
  Withdraw,
} from "@/lib/account";

const NOW = Date.parse("2026-10-27T00:00:00Z");
const at = (ms: number) => ({
  amr: [{ method: "oauth", timestamp: ms / 1000 }],
});

describe("탈퇴 확인 입력", () => {
  it("'탈퇴합니다'를 그대로 보내야 받는다", () => {
    expect(Withdraw.safeParse({ confirm: "탈퇴합니다" }).success).toBe(true);
  });

  it.each([
    ["본문 없음", null],
    ["빈 본문", {}],
    ["다른 글", { confirm: "탈퇴" }],
    ["공백 섞임", { confirm: "탈퇴 합니다" }],
    ["모르는 값", { confirm: "탈퇴합니다", force: true }],
  ])("%s는 받지 않는다", (_, body) => {
    expect(Withdraw.safeParse(body).success).toBe(false);
  });
});

describe("다시 로그인 확인", () => {
  it("인증 시각은 amr 중 가장 최근 것", () => {
    expect(
      lastSignInMs({
        amr: [
          { method: "oauth", timestamp: 100 },
          { method: "oauth", timestamp: 300 },
        ],
      }),
    ).toBe(300_000);
    expect(lastSignInMs({})).toBe(0);
    expect(lastSignInMs({ amr: "oauth" })).toBe(0);
  });

  it("24시간 이내면 바로, 넘었으면 다시 로그인", () => {
    expect(needsReauth(at(NOW - 60_000), NOW)).toBe(false);
    expect(needsReauth(at(NOW - REAUTH_AFTER_MS), NOW)).toBe(false);
    expect(needsReauth(at(NOW - REAUTH_AFTER_MS - 1000), NOW)).toBe(true);
  });

  it("인증 시각이 없으면 다시 로그인한다", () => {
    expect(needsReauth({}, NOW)).toBe(true);
    expect(needsReauth({ amr: [{ method: "oauth" }] }, NOW)).toBe(true);
  });
});
