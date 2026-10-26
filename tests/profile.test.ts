import { describe, expect, it } from "vitest";
import {
  avatarChoice,
  hourLabel,
  MeUpdate,
  providerName,
  socialPhoto,
  toProfileUpdate,
} from "@/lib/profile";

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
    ["모르는 값", { email: "a@b.c" }],
    ["닉네임 1자", { nickname: "윤" }],
    ["공백만 닉네임", { nickname: "   " }],
    ["닉네임 13자", { nickname: "가나다라마바사아자차카타파" }],
    ["이모지 1개 닉네임", { nickname: "😀" }],
    ["사진 주소를 직접 보냄", { avatar: "https://evil.example/a.png" }],
    ["없는 아바타", { avatar: "purple" }],
    ["시각을 직접 보냄", { agreed_at: NOW }],
  ])("%s는 받지 않는다", (_, body) => {
    expect(MeUpdate.safeParse(body).success).toBe(false);
  });

  it("프로필 편집 값을 받는다. 닉네임은 앞뒤 공백을 빼고 글자 수로 센다", () => {
    expect(
      MeUpdate.parse({
        nickname: "  테일러  ",
        avatar: "mint",
        shareNickname: false,
      }),
    ).toEqual({ nickname: "테일러", avatar: "mint", shareNickname: false });
    expect(
      MeUpdate.parse({ nickname: "가나다라마바사아자차카타" }).nickname,
    ).toBe("가나다라마바사아자차카타");
    expect(MeUpdate.parse({ nickname: "😀😀" }).nickname).toBe("😀😀");
  });

  it("소셜 사진을 고르면 로그인 정보의 사진 주소를 적는다", () => {
    expect(
      toProfileUpdate({ avatar: "social" }, NOW, "https://x/a.png"),
    ).toEqual({
      avatar: "https://x/a.png",
    });
    expect(toProfileUpdate({ avatar: "social" }, NOW)).toEqual({
      avatar: null,
    });
    expect(
      toProfileUpdate(
        { avatar: "sky", nickname: "윤기", shareNickname: false },
        NOW,
      ),
    ).toEqual({ avatar: "sky", nickname: "윤기", share_nickname: false });
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

describe("프로필 이미지와 로그인 방법", () => {
  it("저장된 값이 어느 선택지인지 안다", () => {
    expect(avatarChoice("mint")).toBe("mint");
    expect(avatarChoice("https://x/a.png")).toBe("social");
    expect(avatarChoice(null)).toBe("social");
    expect(avatarChoice("social")).toBe("social");
  });

  it("소셜 사진은 https 주소만 쓴다", () => {
    expect(socialPhoto({ avatar_url: "https://x/a.png" })).toBe(
      "https://x/a.png",
    );
    expect(socialPhoto({ picture: "https://x/p.png" })).toBe("https://x/p.png");
    expect(socialPhoto({ avatar_url: "javascript:alert(1)" })).toBeNull();
    expect(socialPhoto(undefined)).toBeNull();
  });

  it("로그인 방법 이름", () => {
    expect(providerName("github")).toBe("GitHub");
    expect(providerName("kakao")).toBe("카카오");
    expect(providerName(undefined)).toBe("이메일");
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
