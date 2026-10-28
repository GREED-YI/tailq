"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// 앱 뼈대 안 화면 오류: 메뉴는 그대로 두고 내용 자리에 안내와 다시 시도
export default function GroupError({ reset }: { reset: () => void }) {
  return <ErrorScreen reset={reset} inShell />;
}
