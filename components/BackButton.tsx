"use client";

import { useRouter } from "next/navigation";
import { Icon } from "./icons";

// 위쪽 뒤로 버튼(Figma TopBar Back). 새 탭으로 열려 돌아갈 곳이 없으면(온보딩에서 연 약관 등)
// 그 탭을 닫아 원래 탭으로 돌아가고, 닫히지 않으면 첫 화면으로 간다.
// 처음엔 바로 첫 화면으로 보냈는데, 온보딩 중인 사용자는 / → /home → /onboarding으로 한 번 더 열렸다
export function BackButton({
  onClick,
  className = "",
}: {
  onClick?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const back = () => {
    if (window.history.length > 1) return router.back();
    window.close();
    if (!window.closed) router.push("/");
  };
  return (
    <button
      type="button"
      className={`glass press icon-btn ${className}`}
      aria-label="뒤로"
      onClick={onClick ?? back}
    >
      <Icon name="chevronLeft" />
    </button>
  );
}
