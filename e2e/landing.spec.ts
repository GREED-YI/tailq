import { expect, test } from "@playwright/test";

// 로그인 없이 보는 랜딩(docs/04 10번). E2E는 Supabase 없이 돌아 체험 질문 미리보기는 비어 있다
test("섹션이 문서 순서대로 있다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "이렇게 되물어요",
    "TailQ로 이렇게 연습해요",
    "이렇게 진행돼요",
    "꼬리잇기",
    /지금 바로\s*한 문제 풀어보기/,
  ]);
  await expect(page.getByRole("contentinfo")).toContainText("이용약관");
});

test("채점 데모: 채점해 보기 → 점수와 꼬리질문 → 다시 보기", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "이 답변으로 채점해 보기" }).click();
  await expect(page.getByText("꼬리질문이 이어져요")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "100점 만점에 72점" }),
  ).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "다시 보기" }).click();
  await expect(
    page.getByRole("button", { name: "이 답변으로 채점해 보기" }),
  ).toBeVisible();
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
