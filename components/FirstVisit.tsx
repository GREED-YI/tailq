"use client";

import { useEffect } from "react";
import { ANON_COOKIE } from "@/lib/events";

// 이 브라우저에 무작위 값이 아직 없으면 첫 방문을 알린다. 서버가 값을 주고 첫 방문을 남긴다.
// 화면을 그린 뒤 브라우저에서 보내므로 링크 미리보기 봇처럼 스크립트를 돌리지 않는 요청은 세지 않는다.
// 개발 모드의 effect 두 번 실행에도 한 번만 보낸다(두 번 보내면 무작위 값이 둘 생긴다)
let sent = false;

export function FirstVisit() {
  useEffect(() => {
    if (
      sent ||
      document.cookie.split("; ").some((c) => c.startsWith(`${ANON_COOKIE}=`))
    )
      return;
    sent = true;
    fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "first_visit" }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
