// 브라우저 쪽 웹 푸시 구독(#37). 온보딩 ③(S08), MY 알림 창, 홈 알림 안내(S32)가 같이 쓴다.
// VAPID 공개 키는 서버 컴포넌트가 VAPID_PUBLIC_KEY를 읽어 넘긴다(브라우저 환경변수를 늘리지 않는다).

export type SubscribeResult =
  "ok" | "install" | "denied" | "unsupported" | "failed";

export const SUBSCRIBE_ERRORS: Record<
  Exclude<SubscribeResult, "ok">,
  string
> = {
  install:
    "아이폰은 Safari 공유 버튼 → '홈 화면에 추가'를 누르고, 홈 화면의 TailQ에서 알림을 켜 주세요. iOS 16.4 이상에서 돼요.",
  denied:
    "브라우저에서 알림이 막혀 있어요. 주소창 왼쪽 아이콘에서 알림을 허용해 주세요.",
  unsupported:
    "이 브라우저에서는 알림을 받을 수 없어요. Chrome, Edge, Safari 최신 버전에서 켜 주세요.",
  failed: "알림을 켜지 못했어요. 다시 시도해 주세요.",
};

export const pushSupported = () =>
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

// 아이폰·아이패드는 홈 화면에 추가한 앱에서만 웹 푸시가 된다(iOS 16.4 이상, 04 기능 명세 7장).
// 아이패드는 데스크톱 Safari처럼 Macintosh로 보이므로 터치 지원으로 가린다
export function needsInstall() {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return ios && !matchMedia("(display-mode: standalone)").matches;
}

function base64UrlToBytes(base64: string) {
  const b64 = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// 권한을 받고 이 기기를 구독해 서버에 저장한다. 이미 구독했으면 같은 구독을 다시 저장한다(멱등).
// 누른 순간 권한 창을 띄워야 하므로 버튼 클릭에서 바로 부른다
export async function subscribePush(
  vapidKey: string,
): Promise<SubscribeResult> {
  if (needsInstall()) return "install";
  if (!pushSupported() || !vapidKey) return "unsupported";
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  try {
    await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none",
    });
    const { pushManager } = await navigator.serviceWorker.ready;
    const sub =
      (await pushManager.getSubscription()) ??
      (await pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(vapidKey),
      }));
    const res = await fetch("/api/push-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sub),
    });
    return res.ok ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

// 이 기기의 구독을 서버와 브라우저에서 지운다. mine: 서버가 읽어 준 내 구독(RLS로 자기 행만)
export async function unsubscribePush(
  mine: { id: string; endpoint: string }[],
) {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const row = mine.find((m) => m.endpoint === sub.endpoint);
  if (row) {
    await fetch(`/api/push-subscriptions/${row.id}`, { method: "DELETE" });
  }
  await sub.unsubscribe();
}
