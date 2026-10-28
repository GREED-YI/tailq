import { expect, test } from "@playwright/test";

// 로그인 없이 보는 랜딩(docs/04 10번). E2E는 Supabase 없이 돌아 체험 질문 미리보기는 비어 있다
test("섹션이 문서 순서대로 있다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "하루 한 문제, AI가 채점하고 되묻는 개발자 기술 면접 연습",
  );
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "15개 주제, 매일 한 문제",
    "100점 만점 채점, 잘한 점부터 짚는 피드백",
    "내 답변에서 이어지는 꼬리질문",
    "점수에 맞춰 돌아오는 복습",
    "숫자로 남는 기록과 약한 주제",
    "내 프로젝트 README로 만드는 예상 질문",
    "가입 전에 풀어 보는 한 문제",
  ]);
  await expect(page.getByRole("contentinfo")).toContainText("이용약관");
});

test("첫 화면 버튼은 체험 칸으로 내려가 고른 분야에 초점을 준다", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: "100점 만점에 74점" }).first(),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "로그인 없이 한 문제 풀어보기" })
    .click();
  await expect(page).toHaveURL(/#try$/);
  await expect(page.getByRole("radio", { name: "백엔드" })).toBeFocused();
});

test("꼬리질문 섹션은 페이지와 반대 테마다", async ({ page }) => {
  await page.goto("/");
  const peak = page.locator("#peak");
  await expect(peak).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("button", { name: "라이트 모드로 바꾸기" })
    .first()
    .click();
  await expect(peak).toHaveAttribute("data-theme", "dark");
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
