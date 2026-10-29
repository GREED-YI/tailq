import { expect, test } from "@playwright/test";

test("로그인하지 않으면 기록 상세 대신 로그인으로 간다", async ({ page }) => {
  const id = "00000000-0000-0000-0000-000000000001";
  await page.goto(`/history/${id}`);
  await expect(page).toHaveURL(`/login?next=%2Fhistory%2F${id}`);
});

test("로그인하지 않으면 리포트 대신 로그인으로 간다", async ({ page }) => {
  await page.goto("/report");
  await expect(page).toHaveURL("/login?next=%2Freport");
});

// 복습·기록을 합친 Q노트(#128)
for (const path of ["/questions", "/questions/1"]) {
  test(`로그인하지 않으면 ${path} 대신 로그인으로 간다`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
  });
}
