import { z } from "zod";

// 탈퇴(04 기능 명세 1장, 08 설계 "탈퇴")
export const WITHDRAW_PHRASE = "탈퇴합니다";
export const Withdraw = z.strictObject({ confirm: z.literal(WITHDRAW_PHRASE) });

// 마지막 로그인이 이보다 오래됐으면 같은 소셜 로그인으로 다시 확인한다
export const REAUTH_AFTER_MS = 24 * 60 * 60 * 1000;

// 다시 로그인하러 갈 때 지금 사용자 id를 적어 두는 쿠키. 돌아온 계정이 다르면 탈퇴를 막는다
// (로그인 방법이 다르면 다른 계정이 생기므로, 08 설계 "탈퇴")
export const REAUTH_COOKIE = "tailq-reauth";

// 로그인 토큰의 인증 시각(amr). 토큰을 새로 고쳐도 바뀌지 않고, 다시 로그인해야 바뀐다.
export function lastSignInMs(claims: { amr?: unknown }): number {
  const amr = Array.isArray(claims.amr) ? claims.amr : [];
  return Math.max(
    0,
    ...amr.map(
      (a) => Number((a as { timestamp?: unknown }).timestamp) * 1000 || 0,
    ),
  );
}

export const needsReauth = (claims: { amr?: unknown }, now = Date.now()) =>
  now - lastSignInMs(claims) > REAUTH_AFTER_MS;
