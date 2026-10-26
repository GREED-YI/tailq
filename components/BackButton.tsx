"use client";

import { useRouter } from "next/navigation";
import { Icon } from "./icons";

// 위쪽 뒤로 버튼(Figma TopBar Back). 새 탭으로 열려 돌아갈 곳이 없으면 첫 화면으로 간다.
export function BackButton({
  onClick,
  className = "",
}: {
  onClick?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const back = () =>
    window.history.length > 1 ? router.back() : router.push("/");
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
