const FALLBACK = "/home";
const BASE = "http://tailq.invalid";

// 로그인 뒤 돌아갈 주소. 같은 사이트 안의 경로만 받고, 다른 사이트로 보내는 값은 홈으로 바꾼다.
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return FALLBACK;
  try {
    // 브라우저와 같은 규칙으로 해석해서 //evil.com, /\evil.com 같은 값을 걸러낸다
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return FALLBACK;
    return url.pathname + url.search + url.hash;
  } catch {
    return FALLBACK;
  }
}
