"use client";

import { useRef, useState } from "react";
import { Icon } from "./icons";
import { useToast } from "./Toast";
import s from "./Bookmark.module.css";

// 질문 북마크 별표(04 기능 명세 E-4). 저장·해제는 모달 대신 토스트로 알린다(04 "모달과 토스트")
export function BookmarkButton({
  questionId,
  initial,
  toastTop = false,
}: {
  questionId: number;
  initial: boolean;
  toastTop?: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [toast, showToast] = useToast({ top: toastTop });
  // 요청이 끝나기 전 다시 누르면 PUT·DELETE 순서가 뒤바뀔 수 있어 끝날 때까지 막는다
  const busy = useRef(false);

  async function toggle() {
    if (busy.current) return;
    busy.current = true;
    const next = !on;
    setOn(next);
    const res = await fetch(`/api/bookmarks/${questionId}`, {
      method: next ? "PUT" : "DELETE",
    }).catch(() => null);
    busy.current = false;
    if (res?.ok) {
      showToast(next ? "북마크에 저장했어요" : "북마크에서 뺐어요", "bookmark");
      return;
    }
    setOn(!next);
    const json = await res?.json().catch(() => null);
    showToast(json?.error?.message ?? "잠시 뒤에 다시 시도해 주세요.");
  }

  return (
    <>
      <button
        type="button"
        className={`glass press icon-btn ${s.button}`}
        aria-label="북마크"
        aria-pressed={on}
        onClick={toggle}
      >
        <Icon name="star" size={18} bold={on} />
      </button>
      {/* 상태 변화는 버튼의 aria-pressed로도 읽힌다 */}
      {toast}
    </>
  );
}
