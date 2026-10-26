import { describe, expect, it } from "vitest";
import { hourLabel, MeUpdate, toProfileUpdate } from "@/lib/profile";

const NOW = "2026-10-26T00:00:00.000Z";

describe("내 프로필 바꾸기 입력", () => {
  it("온보딩 단계별 값을 받는다", () => {
    expect(MeUpdate.parse({ agreed: true })).toEqual({ agreed: true });
    expect(
      MeUpdate.parse({ topics: ["dsa", "dsa", "react"], levels: ["basic"] }),
    ).toEqual({ topics: ["dsa", "react"], levels: ["basic"] });
    expect(
      MeUpdate.parse({ notifyOn: true, notifyHour: 0, onboarded: true }),
    ).toEqual({ notifyOn: true, notifyHour: 0, onboarded: true });
  });

  it.each([
    ["빈 본문", {}],
    ["본문 없음", null],
    ["동의 거부", { agreed: false }],
    ["주제 0개", { topics: [] }],
    ["난이도 0개", { levels: [] }],
    ["없는 난이도", { levels: ["expert"] }],
    ["알림 시각 24시", { notifyHour: 24 }],
    ["알림 시각 소수", { notifyHour: 8.5 }],
    ["온보딩 취소", { onboarded: false }],
    ["모르는 값", { nickname: "바꾼이름" }],
    ["시각을 직접 보냄", { agreed_at: NOW }],
  ])("%s는 받지 않는다", (_, body) => {
    expect(MeUpdate.safeParse(body).success).toBe(false);
  });

  it("보낸 값만 DB 열로 바꾸고 시각은 서버 시계로 적는다", () => {
    expect(toProfileUpdate({ agreed: true }, NOW)).toEqual({ agreed_at: NOW });
    expect(toProfileUpdate({ notifyOn: false, onboarded: true }, NOW)).toEqual({
      notify_on: false,
      onboarded_at: NOW,
    });
    expect(
      toProfileUpdate({ topics: ["os"], levels: ["mid"], notifyHour: 0 }, NOW),
    ).toEqual({ topics: ["os"], levels: ["mid"], notify_hour: 0 });
  });
});

describe("알림 시각 표시", () => {
  it.each([
    [0, "오전 12:00"],
    [8, "오전 8:00"],
    [12, "오후 12:00"],
    [23, "오후 11:00"],
  ])("%i시는 %s", (hour, label) => {
    expect(hourLabel(hour)).toBe(label);
  });
});
