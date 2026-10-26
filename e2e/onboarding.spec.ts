import { expect, test } from "@playwright/test";

test("로그인하지 않고 온보딩에 오면 로그인으로 보낸다", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL("/login?next=%2Fonboarding");
});

test("로그인하지 않으면 프로필을 바꿀 수 없다", async ({ request }) => {
  const res = await request.patch("/api/me", { data: { agreed: true } });
  expect(res.status()).toBe(401);
  expect(await res.json()).toEqual({
    error: { code: "UNAUTHORIZED", message: "로그인이 필요해요." },
  });
});
