"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";
import s from "./AppShell.module.css";

// 짧은 알림 토스트(04 "모달과 토스트", Figma S34). 2초 뒤 사라진다.
// const [toast, showToast] = useToast(); showToast("북마크에 저장했어요", "bookmark");
// top: 아래에 탭바 대신 답변 시트가 있는 화면(면접)에서는 헤더 아래에 띄운다
export function useToast({ top = false }: { top?: boolean } = {}) {
  const [toast, setToast] = useState<{
    id: number;
    text: string;
    icon?: IconName;
  }>({ id: 0, text: "" });

  useEffect(() => {
    if (!toast.text) return;
    const t = setTimeout(() => setToast((v) => ({ ...v, text: "" })), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const show = (text: string, icon?: IconName) =>
    setToast((v) => ({ id: v.id + 1, text, icon }));

  // body에 붙인다. 애니메이션(transform)이 걸린 부모 안이면 fixed가 화면 기준이 아니다.
  const node = toast.text
    ? createPortal(
        <div
          role="status"
          className={`${s.toastArea} ${top ? s.toastTop : ""}`}
        >
          <p key={toast.id} className={`glass-strong fade ${s.toast}`}>
            {toast.icon && <Icon name={toast.icon} size={18} />}
            {toast.text}
          </p>
        </div>,
        document.body,
      )
    : null;

  return [node, show] as const;
}
