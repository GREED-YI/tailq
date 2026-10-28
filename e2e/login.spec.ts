import { expect, test } from "@playwright/test";

test("로그인 화면에 소셜 로그인 버튼 3개와 계정 안내가 있다", async ({
  page,
}) => {
  await page.goto("/login");
  for (const name of [
    "GitHub로 계속하기",
    "Google로 계속하기",
    "카카오로 계속하기",
  ]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
  await expect(page.getByText("새 계정이 만들어져요")).toBeVisible();
  await expect(page.getByRole("link", { name: "뒤로" })).toHaveAttribute(
    "href",
    "/",
  );
  // 로그인 전 화면 공통 푸터(SiteFooter)
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "이용약관" })).toHaveAttribute(
    "href",
    "/terms",
  );
  await expect(
    footer.getByRole("link", { name: "개인정보처리방침" }),
  ).toHaveAttribute("href", "/privacy");
});

test("로그인하지 않고 앱 화면에 오면 로그인으로 보낸다", async ({ page }) => {
  await page.goto("/home");
  await expect(page).toHaveURL("/login?next=%2Fhome");
});

test("로그인에 실패하면 안내를 보여준다", async ({ page }) => {
  await page.goto("/auth/callback?error=access_denied&next=//evil.com");
  await expect(page).toHaveURL("/login?error=auth&next=%2Fhome");
  await expect(
    page.getByRole("alert").filter({ hasText: "로그인하지 못했어요" }),
  ).toBeVisible();
});
