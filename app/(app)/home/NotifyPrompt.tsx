"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  pushSupported,
  SUBSCRIBE_ERRORS,
  subscribePush,
} from "@/lib/client/push-client";
import { hourLabel } from "@/lib/profile";
import s from "../my/my.module.css";
import { openModal, useCloseOnLeave } from "@/lib/dialog";

const LATER_KEY = "tailq-notify-later";

// 알림 권한 사전 안내(S32). 오늘 질문을 끝낸 홈(S12)에서 알림이 꺼져 있고, 이 기기에서 아직
// 브라우저 권한을 묻지 않았으면 한 번 띄운다. "나중에"를 누르면 이 기기에서는 다시 띄우지 않는다.
// 브라우저 권한 창은 "알림 받기"를 누른 뒤에 뜬다(04 기능 명세 "모달").
// 알림 시각은 온보딩 3단계에 있다가 여기로 옮겼다(R2). 고르는 줄은 MY 알림 창과 같은 모양
export function NotifyPrompt({
  vapidKey,
  initialHour,
}: {
  vapidKey: string;
  initialHour: number;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  useCloseOnLeave(dialog);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hour, setHour] = useState(initialHour);

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
            body: JSON.stringify({ notifyOn: true, notifyHour: hour }),
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
      className={s.dialog}
      aria-labelledby="notify-prompt-title"
      // Esc로 닫아도 "나중에"와 같다
      onCancel={close}
    >
      <h2 id="notify-prompt-title">매일 질문을 알림으로 받을까요?</h2>
      <p>정한 시각에 오늘의 질문을 알려 줄게요. 이미 푼 날은 보내지 않아요.</p>
      <label className={s.dialogRow}>
        <span>알림 시각</span>
        <select
          className={s.select}
          value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </select>
      </label>
      <p>나중에 MY에서 바꿀 수 있어요.</p>
      {error && (
        <p role="alert" className={s.dialogError}>
          {error}
        </p>
      )}
      <div className={s.dialogButtons}>
        <button
          type="button"
          className="btn btn-md btn-secondary press"
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
