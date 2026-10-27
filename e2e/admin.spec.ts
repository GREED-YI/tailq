import { expect, test } from "@playwright/test";

test("운영자가 아니면 운영 대시보드는 로그인으로도 보내지 않고 404다", async ({
  page,
}) => {
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
  await expect(page).toHaveURL("/admin");
  await expect(page.getByText("운영 대시보드")).toHaveCount(0);
});
