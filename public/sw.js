// 웹 푸시 알림을 띄우고, 누르면 홈을 연다(#37, 04 기능 명세 7장).
// 화면 캐시는 하지 않는다(오프라인 지원은 범위 밖).

// 이미 열린 창도 바로 이 워커가 맡게 해, 알림을 누르면 그 창을 홈으로 옮길 수 있게 한다
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "TailQ", {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      // 같은 날 알림이 쌓이지 않게 하나로 바꿔 끼운다
      tag: "daily",
      data: { url: data.url || "/home" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    event.notification.data?.url || "/home",
    self.location.origin,
  ).href;
  const openHome = async () => {
    const windows = await self.clients.matchAll({ type: "window" });
    const open = windows.find((w) => w.url.startsWith(self.location.origin));
    if (open) {
      try {
        return await (await open.navigate(url)).focus();
      } catch {
        // 이 워커가 맡지 않은 창이면 새 창으로 연다
      }
    }
    return self.clients.openWindow(url);
  };
  event.waitUntil(
    Promise.all([
      // 알림 클릭 지표(#44). 실패해도 화면은 연다
      fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "notification_click" }),
      }).catch(() => {}),
      openHome(),
    ]),
  );
});
