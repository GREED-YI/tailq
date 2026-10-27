"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  pushSupported,
  SUBSCRIBE_ERRORS,
  subscribePush,
} from "@/lib/push-client";
import s from "../my/my.module.css";
import { openModal, useCloseOnLeave } from "@/lib/dialog";

const LATER_KEY = "tailq-notify-later";

// 알림 권한 사전 안내(S32). 오늘 질문을 끝낸 홈(S12)에서 알림이 꺼져 있고, 이 기기에서 아직
// 브라우저 권한을 묻지 않았으면 한 번 띄운다. "나중에"를 누르면 이 기기에서는 다시 띄우지 않는다.
// 브라우저 권한 창은 "알림 받기"를 누른 뒤에 뜬다(04 기능 명세 "모달").
export function NotifyPrompt({ vapidKey }: { vapidKey: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  useCloseOnLeave(dialog);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let later = false;
    try {
      later = localStorage.getItem(LATER_KEY) !== null;
    } catch {
      // 저장소를 못 쓰면 매번 묻는다
    }
    if (!later && pushSupported() && Notification.permission === "default")
      openModal(dialog.current);
  }, []);

  function close() {
    try {
      localStorage.setItem(LATER_KEY, "1");
    } catch {
      // 저장소를 못 쓰면 다음 방문에 다시 묻는다
    }
    dialog.current?.close();
  }

  async function allow() {
    setBusy(true);
    setError("");
    const result = await subscribePush(vapidKey);
    const res =
      result === "ok"
        ? await fetch("/api/me", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ notifyOn: true }),
          }).catch(() => null)
        : null;
    setBusy(false);
    if (result !== "ok") return setError(SUBSCRIBE_ERRORS[result]);
    if (!res?.ok) return setError("저장하지 못했어요. 다시 시도해 주세요.");
    close();
    router.refresh();
  }

  return (
    <dialog
      ref={dialog}
      className={`glass-strong ${s.dialog}`}
      aria-labelledby="notify-prompt-title"
      // Esc로 닫아도 "나중에"와 같다
      onCancel={close}
    >
      <h2 id="notify-prompt-title">매일 질문을 알림으로 받을까요?</h2>
      <p>
        브라우저 창에서 &apos;허용&apos;을 눌러 주세요.
        <br />
        나중에 MY에서 바꿀 수 있어요.
      </p>
      {error && (
        <p role="alert" className={s.dialogError}>
          {error}
        </p>
      )}
      <div className={s.dialogButtons}>
        <button
          type="button"
          className="btn btn-md btn-secondary glass press"
          onClick={close}
        >
          나중에
        </button>
        <button
          type="button"
          className="btn btn-md btn-primary press"
          disabled={busy}
          onClick={allow}
        >
          알림 받기
        </button>
      </div>
    </dialog>
  );
}
