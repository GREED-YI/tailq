import { describe, expect, it } from "vitest";
import { clientIp, hashIp, newTrialToken } from "@/lib/trial";

describe("체험 IP 가리기", () => {
  it("같은 IP·같은 비밀값이면 같은 값, 원래 IP는 담지 않는다", () => {
    const a = hashIp("203.0.113.7", "secret-a");
    expect(a).toBe(hashIp("203.0.113.7", "secret-a"));
    expect(a).not.toContain("203.0.113.7");
    expect(a).not.toBe(hashIp("203.0.113.8", "secret-a"));
  });

  it("비밀값이 다르면 값도 달라 비밀값 없이는 IP를 대입해 찾을 수 없다", () => {
    expect(hashIp("203.0.113.7", "secret-a")).not.toBe(
      hashIp("203.0.113.7", "secret-b"),
    );
  });

  it("비밀값이 없으면 그냥 해시로 대신하지 않고 실패한다", () => {
    expect(() => hashIp("203.0.113.7", "")).toThrow("TRIAL_IP_HMAC_SECRET");
  });
});

describe("요청한 사람의 IP", () => {
  it("x-forwarded-for의 맨 앞 값을 쓴다", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientIp(h)).toBe("203.0.113.7");
  });

  it("없으면 x-real-ip, 그것도 없으면 unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe(
      "198.51.100.2",
    );
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

it("체험 토큰은 매번 다른 무작위 값이다", () => {
  const t = newTrialToken();
  expect(t).toMatch(/^[\w-]{32}$/);
  expect(t).not.toBe(newTrialToken());
});
