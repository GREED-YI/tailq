import { expect, test } from "@playwright/test";

test("로그인하지 않으면 MY 대신 로그인으로 간다", async ({ page }) => {
  await page.goto("/my");
  await expect(page).toHaveURL("/login?next=%2Fmy");
});

test("로그인하지 않으면 프로필 편집 대신 로그인으로 간다", async ({ page }) => {
  await page.goto("/my/profile");
  await expect(page).toHaveURL("/login?next=%2Fmy%2Fprofile");
});

test("로그인하지 않고 프로필을 바꿀 수 없다", async ({ request }) => {
  const res = await request.patch("/api/me", { data: { nickname: "테일러" } });
  expect(res.status()).toBe(401);
});
