"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// 질문을 만드는 프로젝트가 있는 동안 목록을 2초마다 다시 읽는다(상세 ProjectView와 같은 간격).
// 다 만들어지면 서버가 이 컴포넌트를 그리지 않아 저절로 멈춘다
export function RefreshWhileGenerating() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
