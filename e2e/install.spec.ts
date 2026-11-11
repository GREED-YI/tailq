import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, supabase } from "./login";

// 앱 설치 버튼(#150)은 MY에만 있고, 홈 첫 방문 안내는 04줄로 MY를 가리킨다(#167). 로그인한 화면이라 로컬 Supabase가 있을 때만 돈다
test.skip(!supabase, "로컬 Supabase가 있어야 로그인한 화면을 본다");

const EMAIL = "e2e-install@example.test";

test.beforeEach(async ({ context }) => {
  await login(context, EMAIL);
});

// 크롬이 설치 조건을 갖춘 페이지에 보내는 beforeinstallprompt를 흉내 낸다. prompt()가 불리면 window.prompted
const firePrompt = (page: Page) =>
  page.evaluate(() => {
    const e = Object.assign(
      new Event("beforeinstallprompt", { cancelable: true }),
      {
        prompt: async () => {
          Object.assign(window, { prompted: true });
        },
        userChoice: Promise.resolve({ outcome: "accepted" }),
      },
    );
    dispatchEvent(e);
  });

// 설치 모듈이 리스너를 건 뒤(hydration 뒤)에 이벤트가 닿을 때까지 다시 보낸다
async function promptUntilVisible(page: Page, target: Locator) {
  await expect(async () => {
    await firePrompt(page);
    await expect(target).toBeVisible({ timeout: 500 });
  }).toPass();
  return target;
}

const guideOf = (page: Page) =>
  page.getByRole("note", { name: "TailQ는 이렇게 써요" });
// 첫 방문 안내 04줄(#167). 설치할 수 있을 때만 그린다
const installLine = (page: Page) =>
  guideOf(page).getByText("에서 앱을 설치하면", { exact: false });

const eventSent = (page: Page, name: string) =>
  page.waitForRequest(
    (r) =>
      r.url().endsWith("/api/events") &&
      r.method() === "POST" &&
      r.postDataJSON()?.name === name,
  );

test("크롬은 설치 이벤트가 오면 MY 설정 끝 줄에 버튼이 보이고, 누르면 설치 창을 띄운다", async ({
  page,
}) => {
  await page.goto("/my");
  const row = await promptUntilVisible(
    page,
    page.getByRole("button", { name: /^앱 설치/ }),
  );
  // 설정 구획의 맨 끝 줄
  await expect(
    page.getByRole("region", { name: "설정" }).getByRole("listitem").last(),
  ).toContainText("앱 설치");

  const click = eventSent(page, "install_click");
  await row.click();
  await click;
  expect(await page.evaluate(() => "prompted" in window)).toBe(true);

  // 설치를 마치면 버튼 대신 "설치했어요"를 한 번 알린다
  const installed = eventSent(page, "app_installed");
  await page.evaluate(() => dispatchEvent(new Event("appinstalled")));
  await installed;
  await expect(page.getByRole("status").getByText("설치했어요")).toBeVisible();
  await expect(row).toHaveCount(0);
});

test("설치 이벤트가 없는 브라우저(미지원)는 홈 첫 방문 안내에 04줄이 없다", async ({
  page,
}) => {
  await page.goto("/home");
  await expect(guideOf(page)).toBeVisible();
  // 설치 모듈이 판정을 마칠 때까지 기다린 뒤에도 줄 자리조차 없다
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await expect(installLine(page)).toHaveCount(0);
  await expect(guideOf(page).getByRole("listitem")).toHaveCount(3);
});

test("크롬은 설치 이벤트가 오면 홈 첫 방문 안내에 04줄이 들어오고, MY 링크로 간다", async ({
  page,
}) => {
  await page.goto("/home");
  const guide = guideOf(page);
  await expect(guide).toBeVisible();
  await promptUntilVisible(page, installLine(page));
  await expect(guide.getByRole("listitem")).toHaveCount(4);
  // 홈에는 설치 버튼이 없다
  await expect(page.getByRole("button", { name: /앱 설치/ })).toHaveCount(0);

  await guide.getByRole("link", { name: "MY" }).click();
  await expect(page).toHaveURL(/\/my$/);
});

test.describe("홈 화면 앱으로 열면", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (q) =>
        original(q.includes("display-mode: standalone") ? "all" : q);
    });
  });

  test("설치 이벤트가 와도 버튼을 숨긴다", async ({ page }) => {
    await page.goto("/my");
    await expect(
      page.getByRole("button", { name: /^화면 테마/ }),
    ).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await firePrompt(page);
      await page.waitForTimeout(300);
    }
    await expect(page.getByRole("button", { name: /^앱 설치/ })).toHaveCount(0);
  });

  test("설치 이벤트가 와도 홈 첫 방문 안내에 04줄이 없다", async ({ page }) => {
    await page.goto("/home");
    await expect(guideOf(page)).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await firePrompt(page);
      await page.waitForTimeout(300);
    }
    await expect(installLine(page)).toHaveCount(0);
    await expect(guideOf(page).getByRole("listitem")).toHaveCount(3);
  });
});

test.describe("아이폰", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });

  test("홈 첫 방문 안내에 04줄이 보이고, MY의 앱 설치를 누르면 홈 화면에 추가 안내가 열린다", async ({
    page,
  }) => {
    await page.goto("/home");
    await expect(installLine(page)).toBeVisible();
    await expect(page.getByRole("button", { name: /앱 설치/ })).toHaveCount(0);

    await page.goto("/my");
    const button = page.getByRole("button", { name: /^앱 설치/ });
    await expect(button).toHaveAttribute("aria-haspopup", "dialog");

    const click = eventSent(page, "install_click");
    await button.click();
    await click;
    const dialog = page.getByRole("dialog", { name: "홈 화면에 추가하기" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Safari 아래쪽 공유 버튼을 눌러요");
    await expect(dialog.getByRole("button", { name: "닫기" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
  });
});
