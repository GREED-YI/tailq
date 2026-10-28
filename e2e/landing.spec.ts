import { expect, test } from "@playwright/test";

// 로그인 없이 보는 랜딩(docs/04 10번). E2E는 Supabase 없이 돌아 체험 질문 미리보기는 비어 있다
test("섹션이 문서 순서대로 있다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "하루 한 문제, AI가 채점하고 되묻는 개발자 기술 면접 연습",
  );
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "오늘의 질문부터 복습까지, 실제 화면 그대로",
    "100점 만점 채점, 잘한 점부터 짚는 피드백",
    "내 답변에서 이어지는 꼬리질문",
    "점수에 맞춰 돌아오는 복습, Q노트",
    "숫자로 남는 기록과 약한 주제",
    "학습 자료 파일을 올리면 질문 5개",
    "가입 전에 풀어 보는 한 문제",
  ]);
  await expect(page.getByRole("contentinfo")).toContainText("이용약관");
});

test("첫 화면 버튼은 체험 칸으로 내려가 고른 분야에 초점을 준다", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: /^면접 채점 결과/ }).first(),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "로그인 없이 한 문제 풀어보기" })
    .click();
  await expect(page).toHaveURL(/#try$/);
  await expect(page.getByRole("radio", { name: "백엔드" })).toBeFocused();
});

test("꼬리질문 섹션은 페이지와 반대 테마이고, 캡처도 그 테마를 따른다", async ({
  page,
}) => {
  await page.goto("/");
  const peak = page.locator("#peak");
  // 다크 페이지: 정점 밖은 다크 캡처, 정점 안은 라이트 캡처가 보인다
  const shown = (sel: string) =>
    page
      .locator(sel)
      .evaluateAll((els) =>
        els
          .filter((e) => getComputedStyle(e).display !== "none")
          .map((e) => e.getAttribute("data-shot")),
      );
  await expect(peak).toHaveAttribute("data-theme", "light");
  expect(new Set(await shown("main > section:first-child picture"))).toEqual(
    new Set(["dark"]),
  );
  expect(new Set(await shown("#peak picture"))).toEqual(new Set(["light"]));
  await page
    .getByRole("button", { name: "라이트 모드로 바꾸기" })
    .first()
    .click();
  await expect(peak).toHaveAttribute("data-theme", "dark");
  expect(new Set(await shown("main > section:first-child picture"))).toEqual(
    new Set(["light"]),
  );
  expect(new Set(await shown("#peak picture"))).toEqual(new Set(["dark"]));
});

test("화면 줄은 이전·다음 버튼으로 한 칸씩 넘긴다", async ({ page }) => {
  await page.goto("/");
  const reel = page.getByRole("region", { name: "실제 화면 10장" });
  await expect(reel.getByRole("listitem")).toHaveCount(10);
  await page.getByRole("button", { name: "다음 화면 보기" }).click();
  await expect
    .poll(() => reel.evaluate((e) => e.scrollLeft))
    .toBeGreaterThan(0);
});

test("녹화는 화면에 보일 때만 재생하고, 멈추기를 켜면 선다", async ({
  page,
}) => {
  await page.goto("/");
  const video = page.locator('video[data-shot="dark"]');
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await video.scrollIntoViewIfNeeded();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(false);
  await page.getByLabel("녹화 멈추기").check();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
});

test("동작 줄이기면 녹화 대신 정지 화면이고 정점도 붙지 않는다", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator("video:visible")).toHaveCount(0);
  await expect(page.getByLabel("녹화 멈추기")).toBeHidden();
  await expect(
    page.getByRole("img", { name: /^학습 자료 등록/ }),
  ).toBeVisible();
  expect(
    await page
      .locator("#peak > div")
      .evaluate((e) => getComputedStyle(e).position),
  ).toBe("static");
  await ctx.close();
});

test("체험 분야는 하나만 고르고, 시작 버튼이 분야를 따라간다", async ({
  page,
}) => {
  await page.goto("/");
  const group = page.getByRole("radiogroup", { name: "체험할 분야" });
  await expect(group.getByRole("radio", { checked: true })).toHaveText(
    "백엔드",
  );
  await group.getByRole("radio", { name: "프론트엔드" }).click();
  await expect(group.getByRole("radio", { checked: true })).toHaveText(
    "프론트엔드",
  );
  await expect(
    page.getByRole("button", { name: "프론트엔드로 시작하기" }),
  ).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(group.getByRole("radio", { checked: true })).toHaveText(
    "백엔드",
  );
});

test("모바일에서 가로로 넘치지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("체험을 시작하지 않았으면 체험 화면 대신 랜딩의 체험 칸으로 간다", async ({
  page,
}) => {
  await page.goto("/trial");
  await expect(page).toHaveURL("/#try");
  await page.goto("/trial/result");
  await expect(page).toHaveURL("/#try");
});

test("체험 분야가 아니면 시작할 수 없다", async ({ request }) => {
  const res = await request.post("/api/trial-sessions", {
    data: { field: "design" },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error.code).toBe("VALIDATION");
});
