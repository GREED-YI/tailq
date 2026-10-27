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

test("문서 탭을 여러 번 바꿔도 뒤로 가면 들어온 곳으로 바로 간다", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "이용약관" }).click();
  await expect(page).toHaveURL("/terms");
  const tabs = page.getByRole("navigation", { name: "문서 선택" });
  for (const [name, url] of [
    ["개인정보처리방침", "/privacy"],
    ["이용약관", "/terms"],
    ["개인정보처리방침", "/privacy"],
  ]) {
    await tabs.getByRole("link", { name }).click();
    await expect(page).toHaveURL(url);
  }
  await page.getByRole("button", { name: "뒤로" }).click();
  await expect(page).toHaveURL("/");
});
