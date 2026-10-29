import type { NextConfig } from "next";

// 보안 헤더(docs/10 보안 점검 "웹"). 모든 응답에 붙인다.
// CSP는 둘로 나눈다. 깨질 일이 없는 것(다른 사이트가 틀로 넣기·플러그인·base 태그)만 바로 막고,
// 스크립트·연결 출처는 Next 인라인 스크립트·Vercel 미리보기 도구를 깨지 않는지 보려고 report-only로 둔다
const enforcedCsp =
  "frame-ancestors 'none'; object-src 'none'; base-uri 'self'";
const reportOnlyCsp = [
  "default-src 'self'",
  // 테마 첫 그림 스크립트와 RSC 데이터가 인라인이다. nonce는 모든 화면을 동적으로 만들어 쓰지 않는다
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // 소셜 프로필 사진은 제공자마다 주소가 달라 https 전체를 연다
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: enforcedCsp },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
};

export default nextConfig;
