"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import s from "./Bookmark.module.css";

// 질문 북마크 별표(04 기능 명세 E-4). 저장·해제는 모달 대신 토스트로 알린다(04 "모달과 토스트")
export function BookmarkButton({
  questionId,
  initial,
}: {
  questionId: number;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [toast, setToast] = useState({ id: 0, text: "" });
  // 요청이 끝나기 전 다시 누르면 PUT·DELETE 순서가 뒤바뀔 수 있어 끝날 때까지 막는다
  const busy = useRef(false);

  // 토스트는 2초 뒤 사라진다
  useEffect(() => {
    if (!toast.text) return;
    const t = setTimeout(() => setToast((v) => ({ ...v, text: "" })), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const show = (text: string) => setToast((v) => ({ id: v.id + 1, text }));

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
      show(next ? "북마크에 저장했어요" : "북마크에서 뺐어요");
      return;
    }
    setOn(!next);
    const json = await res?.json().catch(() => null);
    show(json?.error?.message ?? "잠시 뒤에 다시 시도해 주세요.");
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
      {/* body에 붙인다. 면접 화면은 애니메이션(transform)이 걸린 부모 안이라 fixed가 화면 기준이 아니다.
          상태 변화는 버튼의 aria-pressed로도 읽힌다 */}
      {toast.text &&
        createPortal(
          <div role="status" className={s.toastArea}>
            <p key={toast.id} className={`glass-strong fade ${s.toast}`}>
              {toast.text}
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}
