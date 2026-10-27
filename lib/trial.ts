import { createHmac, randomBytes } from "node:crypto";

// 로그인 없는 체험(04 기능 명세 10번, 08 설계 "체험과 이어받기").
// 브라우저는 httpOnly 쿠키의 무작위 토큰으로, IP는 서버 비밀값으로 HMAC을 씌운 값으로만 구분한다.
export const TRIAL_COOKIE = "tailq-trial";
export const TRIAL_FIELDS = ["cs", "backend", "frontend"] as const;
export type TrialField = (typeof TRIAL_FIELDS)[number];

export const newTrialToken = () => randomBytes(24).toString("base64url");

// 체험 하루 제한은 한국 시간 날짜 기준이라, 쿠키는 다음 날 정리(4시) 뒤까지만 남긴다
export const trialCookie = (secure: boolean) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure,
  path: "/",
  maxAge: 60 * 60 * 48,
});

// 요청한 사람의 IP. Vercel은 x-forwarded-for 맨 앞에 실제 접속 IP를 넣는다(사용자가 보낸 값은 덮어쓴다)
export function clientIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

// IP를 그냥 해시하면 모든 IP를 대입해 되찾을 수 있어 서버 비밀값으로 HMAC을 씌운다(개인정보처리방침).
// 비밀값이 없으면 원래 값이 쉽게 드러나는 해시로 대신하지 않고 실패한다
export function hashIp(ip: string, secret = process.env.TRIAL_IP_HMAC_SECRET) {
  if (!secret) throw new Error("TRIAL_IP_HMAC_SECRET is not set");
  return createHmac("sha256", secret).update(ip).digest("base64url");
}
