"use client";

import {
  useId,
  type ReactEventHandler,
  type ReactNode,
  type RefObject,
} from "react";
import { useCloseOnLeave } from "@/lib/dialog";
import s from "./Dialog.module.css";

// 가운데 확인 창. 브라우저 기본 <dialog>라 Esc로 닫기, 바깥 초점 막기, 닫으면 연 요소로 초점 복귀가 된다.
// 여는 쪽이 openModal(ref.current)로 열고, 화면을 떠나면 여기서 닫는다.
// 버튼 줄·한 줄 조작·오류 문구는 Dialog.module.css의 buttons·row·select·error를 쓴다
export function Dialog({
  ref,
  title,
  closeOnBackdrop,
  onCancel,
  onClose,
  children,
}: {
  ref: RefObject<HTMLDialogElement | null>;
  title: string;
  // 바깥(어두운 바탕)을 누르면 닫는다
  closeOnBackdrop?: boolean;
  onCancel?: ReactEventHandler<HTMLDialogElement>;
  onClose?: ReactEventHandler<HTMLDialogElement>;
  children: ReactNode;
}) {
  const id = useId();
  useCloseOnLeave(ref);
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby={id}
      onClick={
        closeOnBackdrop
          ? (e) => e.target === e.currentTarget && e.currentTarget.close()
          : undefined
      }
      onCancel={onCancel}
      onClose={onClose}
    >
      <h2 id={id}>{title}</h2>
      {children}
    </dialog>
  );
}
