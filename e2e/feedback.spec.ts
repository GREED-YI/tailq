import { expect, test } from "@playwright/test";

test("로그인하지 않으면 피드백 화면 대신 로그인으로 가고, 로그인 뒤 돌아온다", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "피드백 보내기" }).click();
  await expect(page).toHaveURL("/login?next=%2Fmy%2Ffeedback");
});

test("로그인하지 않고 피드백을 보낼 수 없다", async ({ request }) => {
  const res = await request.post("/api/feedback", {
    data: { body: "로그인 없이 보내 볼게요" },
  });
  expect(res.status()).toBe(401);
});

test("운영자가 아니면 피드백 목록은 404다", async ({ page }) => {
  const res = await page.goto("/admin/feedback");
  expect(res?.status()).toBe(404);
});
