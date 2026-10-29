import { useSyncExternalStore } from "react";
import type { CLIENT_EVENTS } from "@/lib/events";

// 앱 설치 버튼(#150)의 상태. 판정은 이 파일 한 곳에서 한다. 서버와 hydration 첫 렌더는 늘 hidden이다.
//   hidden      버튼을 그리지 않는다
//   prompt      브라우저 설치 이벤트(beforeinstallprompt)를 쥐고 있다. 누르면 설치 창
//   ios-guide   아이폰·아이패드이고 홈 화면 앱이 아니다. 누르면 "홈 화면에 추가" 안내
//   installing  설치 창을 띄우고 고르기를 기다리거나, 수락한 뒤 appinstalled를 기다린다
//   installed   appinstalled를 받았다. 버튼 대신 "설치했어요"를 한 번 알린다
export type InstallState =
  "hidden" | "prompt" | "ios-guide" | "installing" | "installed";

// 아이패드는 데스크톱 Safari처럼 Macintosh로 보이므로 터치 지원으로 가린다
export const isIos = (
  ua = navigator.userAgent,
  touchPoints = navigator.maxTouchPoints,
) => /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);

export const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches;

// 앱 안 브라우저(카카오톡·네이버·인스타그램·페이스북·라인)는 공유 메뉴에 "홈 화면에 추가"가 없어 안내가 거짓이 된다
const IN_APP = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//;

export function decideInstall(env: {
  ua: string;
  touchPoints: number;
  standalone: boolean;
  hasPrompt: boolean;
}): InstallState {
  if (env.standalone || IN_APP.test(env.ua)) return "hidden";
  if (isIos(env.ua, env.touchPoints)) return "ios-guide";
  return env.hasPrompt ? "prompt" : "hidden";
}

type PromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: PromptEvent | null = null;
let busy = false;
let installed = false;
let toastPending = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function trackEvent(name: (typeof CLIENT_EVENTS)[number]) {
  fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
    keepalive: true,
  }).catch(() => {});
}

// beforeinstallprompt는 페이지당 한 번 일찍 오므로 구독자가 없어도 모듈이 받아 둔다.
// 기본 동작(크롬 모바일의 작은 설치 막대)은 막고 우리 버튼으로 띄운다
if (typeof window !== "undefined") {
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    emit();
  });
  addEventListener("appinstalled", () => {
    deferred = null;
    busy = false;
    installed = true;
    toastPending = true;
    trackEvent("app_installed");
    emit();
  });
  matchMedia("(display-mode: standalone)").addEventListener("change", emit);
}

function snapshot(): InstallState {
  if (installed) return "installed";
  if (busy) return "installing";
  return decideInstall({
    ua: navigator.userAgent,
    touchPoints: navigator.maxTouchPoints,
    standalone: isStandalone(),
    hasPrompt: deferred !== null,
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useInstall = () =>
  useSyncExternalStore(subscribe, snapshot, () => "hidden" as const);

// 홈과 MY가 함께 떠 있어도 "설치했어요"는 한 번만 띄운다
export function takeInstalledToast() {
  const pending = toastPending;
  toastPending = false;
  return pending;
}

// 설치 창을 띄운다. prompt()는 이벤트당 한 번만 부를 수 있어 결과와 상관없이 이벤트를 버린다.
// 수락하면 appinstalled가 올 때까지 installing, 거절하면 hidden(다시 권하지 않는다)
export async function install(): Promise<
  "accepted" | "dismissed" | "failed" | undefined
> {
  const e = deferred;
  if (!e || busy) return;
  busy = true;
  emit();
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    deferred = null;
    if (outcome === "dismissed") busy = false;
    return outcome;
  } catch {
    deferred = null;
    busy = false;
    return "failed";
  } finally {
    emit();
  }
}
