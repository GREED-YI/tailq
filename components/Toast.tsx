"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";
import s from "./AppShell.module.css";

// 짧은 알림 토스트(04 "모달과 토스트", Figma S34). 4초 뒤 사라진다(DESIGN.md toast).
// const [toast, showToast] = useToast(); showToast("북마크에 저장했어요", "bookmark");
// 모든 화면에서 하단 가운데. top: 아래가 답변 시트·버튼으로 막힌 화면(면접·오늘의 결과)은
// 막힌 높이를 재서 그 바로 위 하단 가운데에 띄운다. 처음엔 헤더 아래(위쪽)에 띄웠는데,
// 화면마다 토스트 자리가 달라 시선이 흩어져 하단 가운데로 맞췄다(#114). 옵션 이름은 쓰는 곳 그대로 둔다
export function useToast({ top = false }: { top?: boolean } = {}) {
  const [toast, setToast] = useState<{
    id: number;
    text: string;
    icon?: IconName;
    bottom?: number;
  }>({ id: 0, text: "" });

  useEffect(() => {
    if (!toast.text) return;
    const t = setTimeout(() => setToast((v) => ({ ...v, text: "" })), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const show = (text: string, icon?: IconName) => {
    const bottom = top ? Math.max(20, blockedHeight() + 12) : undefined;
    setToast((v) => ({ id: v.id + 1, text, icon, bottom }));
  };

  // body에 붙인다. 애니메이션(transform)이 걸린 부모 안이면 fixed가 화면 기준이 아니다.
  const node = toast.text
    ? createPortal(
        <div
          role="status"
          className={s.toastArea}
          style={
            toast.bottom === undefined ? undefined : { bottom: toast.bottom }
          }
        >
          <p key={toast.id} className={`fade ${s.toast}`}>
            {toast.icon && <Icon name={toast.icon} size={18} />}
            {toast.text}
          </p>
        </div>,
        document.body,
      )
    : null;

  return [node, show] as const;
}

// 화면 아래쪽(160px 안) 가운데에 있는 버튼(.btn)과 그 위로 쌓인 것까지의 높이.
// 버튼 사이 틈(12px 이하)은 건너 잰다. 토스트 자신은 pointer-events: none이라 잡히지 않는다
function blockedHeight() {
  const at = (y: number) =>
    document
      .elementFromPoint(innerWidth / 2, y)
      ?.closest(".btn")
      ?.getBoundingClientRect().top;
  let y = innerHeight;
  for (let probe = innerHeight - 8; probe > innerHeight - 160; probe -= 8) {
    const top = at(probe);
    if (top !== undefined) {
      y = top;
      break;
    }
  }
  for (let i = 0; i < 4 && y < innerHeight; i++) {
    const top = at(y - 12);
    if (top === undefined) break;
    y = top;
  }
  // 긴 결과 시트를 스크롤해 시트 위쪽이 화면 밖이면 그 위에 띄울 자리가 없다. 화면 안 기본 자리로 둔다
  return y < 120 ? 0 : innerHeight - y;
}
