"use client";

import Link from "next/link";
import { StatusScreen } from "./StatusScreen";

// 화면을 그리다 서버·화면 오류가 나면(empty-state error) 영문 기본 화면 대신 한국어 안내와 다시 시도.
// app/error.tsx(뼈대 밖)와 (app)·(detail)/error.tsx(메뉴를 남기고 뼈대 안)가 같이 쓴다
export function ErrorScreen({
  reset,
  inShell = false,
}: {
  reset: () => void;
  inShell?: boolean;
}) {
  return (
    <StatusScreen
      title="화면을 불러오지 못했어요"
      body="잠시 뒤에 다시 시도해 주세요."
      inShell={inShell}
      alert
    >
      <button type="button" className="btn btn-primary press" onClick={reset}>
        다시 시도하기
      </button>
      <Link href="/" className="btn btn-ghost press">
        홈으로
      </Link>
    </StatusScreen>
  );
}
