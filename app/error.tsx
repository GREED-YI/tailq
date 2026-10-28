"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// 화면 오류(뼈대 밖). 앱 뼈대 안은 메뉴를 남기려고 (app)·(detail)/error.tsx가 먼저 받는다
export default function RootError({ reset }: { reset: () => void }) {
  return <ErrorScreen reset={reset} />;
}
