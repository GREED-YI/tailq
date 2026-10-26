import { expect, test } from "@playwright/test";

const turn = "00000000-0000-0000-0000-000000000001";

test("로그인하지 않으면 면접 화면 대신 로그인으로 간다", async ({ page }) => {
  await page.goto("/interview");
  await expect(page).toHaveURL("/login?next=%2Finterview");
});

test("로그인하지 않고 답변을 채점받을 수 없다", async ({ request }) => {
  const res = await request.put(`/api/turns/${turn}/answer`, {
    data: { text: "가".repeat(40) },
  });
  expect(res.status()).toBe(401);
  expect(await res.json()).toEqual({
    error: { code: "UNAUTHORIZED", message: "로그인이 필요해요." },
  });
});

test("로그인하지 않고 채점을 평가할 수 없다", async ({ request }) => {
  const res = await request.put(`/api/turns/${turn}/rating`, {
    data: { rating: 1 },
  });
  expect(res.status()).toBe(401);
});
