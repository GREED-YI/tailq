import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });

test("기기 설정을 따르고, 바꾼 테마는 새로고침 뒤에도 유지된다", async ({
  page,
}) => {
  await page.goto("/home");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page
    .getByRole("button", { name: "라이트 모드로 바꾸기" })
    .first()
    .click();
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("앱 화면은 공통 탭바와 피드백 링크를 쓴다", async ({ page }) => {
  await page.goto("/home");
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  await expect(nav.getByRole("link", { name: "홈" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: "피드백 보내기" })).toBeVisible();
});
