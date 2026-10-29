import { describe, expect, it } from "vitest";
import { decideInstall, isIos } from "@/lib/client/install";

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1",
  // 아이패드(iPadOS 13+)는 데스크톱 Safari와 같은 UA다
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  chrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  kakao:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5",
  naverAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.0.0)",
  instagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0",
  facebook:
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0]",
  line: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.0.0",
};

const decide = (
  ua: string,
  { touchPoints = 0, standalone = false, hasPrompt = false } = {},
) => decideInstall({ ua, touchPoints, standalone, hasPrompt });

describe("앱 설치 버튼 판정(#150)", () => {
  it("아이폰은 Safari든 크롬이든 홈 화면에 추가 안내", () => {
    expect(isIos(UA.iphone, 5)).toBe(true);
    expect(decide(UA.iphone, { touchPoints: 5 })).toBe("ios-guide");
    expect(decide(UA.iphoneChrome, { touchPoints: 5 })).toBe("ios-guide");
  });

  it("Macintosh UA에 터치가 있으면 아이패드, 없으면 맥", () => {
    expect(isIos(UA.mac, 5)).toBe(true);
    expect(decide(UA.mac, { touchPoints: 5 })).toBe("ios-guide");
    expect(isIos(UA.mac, 0)).toBe(false);
    expect(decide(UA.mac)).toBe("hidden");
  });

  it("홈 화면 앱(standalone)으로 열면 어디서든 숨긴다", () => {
    expect(decide(UA.iphone, { touchPoints: 5, standalone: true })).toBe(
      "hidden",
    );
    expect(decide(UA.chrome, { standalone: true, hasPrompt: true })).toBe(
      "hidden",
    );
  });

  it("앱 안 브라우저에서는 숨긴다", () => {
    for (const ua of [
      UA.kakao,
      UA.naverAndroid,
      UA.instagram,
      UA.facebook,
      UA.line,
    ]) {
      expect(decide(ua, { touchPoints: 5, hasPrompt: true })).toBe("hidden");
    }
  });

  it("안드로이드·PC는 브라우저 설치 이벤트가 있을 때만 보인다", () => {
    expect(decide(UA.chrome, { hasPrompt: true })).toBe("prompt");
    expect(decide(UA.android, { touchPoints: 5, hasPrompt: true })).toBe(
      "prompt",
    );
    expect(decide(UA.chrome)).toBe("hidden");
    expect(decide(UA.android, { touchPoints: 5 })).toBe("hidden");
  });
});
