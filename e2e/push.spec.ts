import { expect, test } from "@playwright/test";

test("비밀 헤더 없이 매시 알림 발송을 부를 수 없다", async ({ request }) => {
  expect((await request.post("/api/cron/push")).status()).toBe(401);
  const res = await request.post("/api/cron/push", {
    headers: { authorization: "Bearer guess" },
  });
  expect(res.status()).toBe(401);
});

test("로그인하지 않고 알림을 구독·해제할 수 없다", async ({ request }) => {
  const sub = await request.post("/api/push-subscriptions", {
    data: {
      endpoint: "https://push.example.test/e2e",
      keys: { p256dh: "k", auth: "a" },
    },
  });
  expect(sub.status()).toBe(401);
  const del = await request.delete(
    "/api/push-subscriptions/00000000-0000-0000-0000-000000000000",
  );
  expect(del.status()).toBe(401);
});

test("홈 화면에 추가할 수 있는 매니페스트와 알림 서비스 워커가 있다", async ({
  request,
}) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({
    name: "TailQ",
    display: "standalone",
    start_url: "/home",
  });
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
  expect((await request.get("/apple-touch-icon.png")).ok()).toBe(true);

  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBe(true);
  expect(await sw.text()).toContain("notificationclick");
});
