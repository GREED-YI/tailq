import { expect, test, type Page } from "@playwright/test";

// 로그인 없이 보는 랜딩(docs/04 10번). E2E는 Supabase 없이 돌아 체험 질문 미리보기는 비어 있다
test("섹션이 문서 순서대로 있고, 기기 틀은 첫 화면에만 있다", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "하루 한 문제, AI가 채점하고 되묻는 개발자 기술 면접 연습",
  );
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "100점 만점 채점, 잘한 점부터",
    "내 답변에서 이어지는 꼬리질문",
    "점수에 맞춰 돌아오는 복습",
    "숫자로 남는 꼬리잇기와 약한 주제",
    "학습 자료 파일을 올리면 질문 5개",
    "가입 전에 풀어 보는 한 문제",
  ]);
  // 휴대폰 틀의 상태 표시줄(9:41)은 첫 화면에만 있다. 가로로 넘기는 줄은 없다
  await expect(page.locator("main > section", { hasText: "9:41" })).toHaveCount(
    1,
  );
  expect(
    await page
      .locator("main *")
      .evaluateAll(
        (els) =>
          els.filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowX))
            .length,
      ),
  ).toBe(0);
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

// 보이는(display) 캡처의 테마들
const shown = (page: Page, sel: string) =>
  page
    .locator(sel)
    .evaluateAll((els) => [
      ...new Set(
        els
          .filter((e) => getComputedStyle(e).display !== "none")
          .map((e) => e.getAttribute("data-shot")),
      ),
    ]);

test("캡처는 테마마다 한 장만 보이고, 꼬리질문 섹션은 반대 테마를 따른다", async ({
  page,
}) => {
  await page.goto("/");
  const peak = page.locator("#peak");
  const outside = "main > section:not(#peak) [data-shot]";
  // 다크 페이지: 정점 밖은 다크 캡처, 정점 안은 라이트 캡처가 보인다
  await expect(peak).toHaveAttribute("data-theme", "light");
  expect(await shown(page, outside)).toEqual(["dark"]);
  expect(await shown(page, "#peak picture")).toEqual(["light"]);
  await page
    .getByRole("button", { name: "라이트 모드로 바꾸기" })
    .first()
    .click();
  await expect(peak).toHaveAttribute("data-theme", "dark");
  expect(await shown(page, outside)).toEqual(["light"]);
  expect(await shown(page, "#peak picture")).toEqual(["dark"]);
});

test("꼬리질문 정점은 스크롤에 붙고, 세 단계가 같은 자리에 포개진다", async ({
  page,
}) => {
  await page.goto("/");
  const stage = page.locator("#peak > div");
  expect(await stage.evaluate((e) => getComputedStyle(e).position)).toBe(
    "sticky",
  );
  // 1280 폭: 흐름 열과 판정 블록이 단계마다 하나씩, 세 단계
  await expect(page.locator("#peak img:visible")).toHaveCount(6);
});

test("동작 줄이기·낮은 창에서는 정점이 붙지 않고 마지막 단계만 보인다", async ({
  browser,
}) => {
  for (const opt of [
    { reducedMotion: "reduce" as const },
    { viewport: { width: 1280, height: 640 } },
  ]) {
    const ctx = await browser.newContext(opt);
    const page = await ctx.newPage();
    await page.goto("/");
    expect(
      await page
        .locator("#peak > div")
        .evaluate((e) => getComputedStyle(e).position),
    ).toBe("static");
    const imgs = page.locator("#peak img:visible");
    await expect(imgs).toHaveCount(2);
    for (const alt of await imgs.evaluateAll((els) =>
      els.map((e) => e.getAttribute("alt")),
    ))
      expect(alt).toContain("꼬리질문 3");
    await ctx.close();
  }
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
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(
    /\/landing\/v02-dark\.(webm|mp4)$/,
  );
  await page.getByLabel("녹화 멈추기").check();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
});

test("동작 줄이기면 녹화 대신 같은 자리에 마지막 장면 그림이 보인다", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator("video:visible")).toHaveCount(0);
  await expect(page.getByLabel("녹화 멈추기")).toBeHidden();
  const poster = page.locator('img[src*="v02-poster"]:visible');
  await poster.scrollIntoViewIfNeeded();
  await expect(poster).toHaveCount(1);
  await ctx.close();
});

test("모바일에서 가로로 넘치지 않고, 녹화 대신 정지 크롭이라 영상을 받지 않는다", async ({
  page,
}) => {
  const videos: string[] = [];
  page.on("request", (r) => {
    if (/\/landing\/v02-(dark|light)\.(webm|mp4)/.test(r.url()))
      videos.push(r.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  // 크롭 그림도 화면 오른쪽 밖으로 나가지 않는다(첫 화면 기기 틀 제외)
  const outside = await page
    .locator("main > section:not(:first-child) img")
    .evaluateAll(
      (els) =>
        els.filter(
          (e) =>
            (e as HTMLElement).offsetParent &&
            e.getBoundingClientRect().right > window.innerWidth + 1,
        ).length,
    );
  expect(outside).toBe(0);
  const note = page.getByRole("img", { name: /^학습 자료 등록/ });
  await note.scrollIntoViewIfNeeded();
  await expect(note).toBeVisible();
  await expect(page.locator("video:visible")).toHaveCount(0);
  expect(videos).toEqual([]);
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
