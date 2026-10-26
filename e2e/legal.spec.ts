import { expect, test } from "@playwright/test";

test("이용약관은 로그인 없이 열린다", async ({ page }) => {
  await page.goto("/terms");
  await expect(page).toHaveTitle("이용약관 · TailQ");
  await expect(page.getByRole("heading", { name: "이용약관" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /AI 채점/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /저작권/ })).toBeVisible();
});

test("개인정보처리방침은 로그인 없이 열리고 필수 항목을 담는다", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(page).toHaveTitle("개인정보처리방침 · TailQ");
  for (const name of [
    "개인정보처리방침",
    /수집 항목/,
    /보관 기간/,
    /국외 이전/,
    /만 14세/,
    /삭제/,
  ]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  await expect(page.getByText("Anthropic, PBC (미국)")).toBeVisible();
});
