// 로그인 세션 쿠키 속성(docs/10 보안 점검 "세션 쿠키"). Supabase 클라이언트를 만드는 곳(server.ts, proxy.ts)이 같이 쓴다.
// 브라우저에서 Supabase를 직접 부르지 않으므로 스크립트가 읽지 못하게 httpOnly로 둔다.
// secure는 프로덕션만(로컬 http 개발이 깨지지 않게). 나머지(SameSite=Lax 등)는 Supabase 기본값이다
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
