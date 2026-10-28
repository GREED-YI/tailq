"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

// 결과 공유하기(04 기능 명세 8번). 카드를 만들고(이미 있으면 그것) 링크를 휴대폰 공유 창으로 넘긴다.
// 공유 창이 없는 브라우저(대부분의 PC)는 링크를 복사하고 토스트로 알린다(04 "모달과 토스트")
export function ShareButton({ sessionId }: { sessionId: string }) {
  const [busy, setBusy] = useState(false);
  // 아래쪽은 버튼이 차지해 토스트를 헤더 아래에 띄운다
  const [toast, showToast] = useToast({ top: true });

  async function share() {
    setBusy(true);
    const res = await fetch("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !json?.url) {
      showToast(json?.error?.message ?? "잠시 뒤에 다시 시도해 주세요.");
      return;
    }

    const url = new URL(json.url, location.origin).href;
    if (navigator.share) {
      // 사용자가 공유 창을 닫으면(AbortError) 그대로 끝, 다른 이유로 실패하면 복사로 넘어간다
      const done = await navigator.share({ title: "TailQ 결과", url }).then(
        () => true,
        (e: unknown) => (e as Error)?.name === "AbortError",
      );
      if (done) return;
    }
    // 보안 컨텍스트가 아니면 navigator.clipboard가 없어 동기로 던지므로 체인 안에서 부른다
    const copied = await Promise.resolve()
      .then(() => navigator.clipboard.writeText(url))
      .then(
        () => true,
        () => false,
      );
    showToast(
      copied ? "공유 링크를 복사했어요" : "링크를 복사하지 못했어요.",
      copied ? "link" : undefined,
    );
  }

  return (
    <>
      {/* 주 버튼은 다음 걸음(홈으로)이 맡고, 공유는 테두리 버튼이다(시안 ResultM) */}
      <button
        type="button"
        className="btn btn-secondary press"
        disabled={busy}
        aria-busy={busy}
        onClick={share}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
        </svg>
        {busy ? "공유 카드 만드는 중" : "결과 공유하기"}
      </button>
      {toast}
    </>
  );
}
