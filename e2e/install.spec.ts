import { expect, test, type Page } from "@playwright/test";
import { login, supabase } from "./login";

// 앱 설치 버튼(#150). 로그인한 화면이라 로컬 Supabase가 있을 때만 돈다
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
async function promptUntilVisible(page: Page, name: RegExp) {
  const button = page.getByRole("button", { name });
  await expect(async () => {
    await firePrompt(page);
    await expect(button).toBeVisible({ timeout: 500 });
  }).toPass();
  return button;
}

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
  const row = await promptUntilVisible(page, /^앱 설치/);
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

test("크롬은 홈 첫 방문 안내의 알겠어요 옆에 앱 설치 버튼이 보인다", async ({
  page,
}) => {
  await page.goto("/home");
  const guide = page.getByRole("note", { name: "TailQ는 이렇게 써요" });
  const box = await guide.boundingBox();
  const button = await promptUntilVisible(page, /^앱 설치$/);
  await expect(guide.getByRole("button", { name: "앱 설치" })).toBeVisible();
  // 같은 줄에 들어가 카드 높이가 변하지 않는다
  expect((await guide.boundingBox())?.height).toBe(box?.height);

  await button.click();
  expect(await page.evaluate(() => "prompted" in window)).toBe(true);
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
});

test.describe("아이폰", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });

  test("누르면 홈 화면에 추가 안내가 열리고 Esc로 닫으면 버튼으로 돌아온다", async ({
    page,
  }) => {
    await page.goto("/home");
    const button = page
      .getByRole("note", { name: "TailQ는 이렇게 써요" })
      .getByRole("button", { name: "앱 설치" });
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

    await page.goto("/my");
    await expect(page.getByRole("button", { name: /^앱 설치/ })).toBeVisible();
  });
});
