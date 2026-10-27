import { expect, test } from "@playwright/test";

test("첫 화면이 열린다", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /하루 한 문제/ }),
  ).toBeVisible();
});
