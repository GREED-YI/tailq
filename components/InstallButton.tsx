"use client";

import { useEffect, useRef } from "react";
import my from "@/app/(app)/my/my.module.css";
import {
  install,
  takeInstalledToast,
  trackEvent,
  useInstall,
} from "@/lib/client/install";
import { openModal } from "@/lib/dialog";
import { Icon } from "./icons";
import { IosInstallGuide } from "./IosInstallGuide";
import { useToast } from "./Toast";

// 앱 설치 버튼(#150). MY 설정 목록 맨 끝 줄. 홈 첫 방문 안내는 버튼 없이 MY로 안내한다(#167).
// 상태는 lib/client/install.ts 한 곳에서 읽는다. 서버와 첫 렌더는 그리지 않는다
export function InstallButton() {
  const state = useInstall();
  const [toast, showToast] = useToast();
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const back = useRef<HTMLElement | null>(null);

  // 버튼이 사라지면(설치 완료, 설치 창에서 거절) 초점을 같은 구획의 앞 요소로 옮기고, 설치 완료는 한 번 알린다
  useEffect(() => {
    if (state !== "hidden" && state !== "installed") return;
    if (document.activeElement === document.body) back.current?.focus();
    back.current = null;
    if (state === "installed" && takeInstalledToast())
      showToast("설치했어요", "check");
  }, [state, showToast]);

  if (state === "hidden" || state === "installed") return toast;
  const busy = state === "installing";

  async function onClick() {
    if (busy) return;
    trackEvent("install_click");
    if (state === "ios-guide") return openModal(dialog.current);
    back.current =
      button.current
        ?.closest("li")
        ?.previousElementSibling?.querySelector("button") ?? null;
    if ((await install()) === "failed")
      showToast("설치하지 못했어요. 브라우저 메뉴에서 설치해 주세요", "info");
  }

  return (
    <li>
      <button
        ref={button}
        type="button"
        onClick={onClick}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        aria-haspopup={state === "ios-guide" ? "dialog" : undefined}
        className={`hover-row ${my.row}`}
      >
        <span className={my.rowText}>
          <strong>앱 설치</strong>
          <span className="num">
            {busy ? "설치하는 중이에요" : "홈 화면에 추가해요"}
          </span>
        </span>
        <Icon name="chevronRight" size={18} />
      </button>
      <span role="status" className="sr-only">
        {busy ? "설치 창을 열었어요" : ""}
      </span>
      {state === "ios-guide" && <IosInstallGuide ref={dialog} />}
      {toast}
    </li>
  );
}
