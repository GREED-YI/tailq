import { expect, test } from "@playwright/test";

test("처음 온 브라우저는 무작위 값을 한 번만 받는다", async ({
  page,
  context,
}) => {
  const firstVisit = page.waitForResponse("**/api/events");
  await page.goto("/privacy");
  expect((await firstVisit).status()).toBe(204);
  const anon = (await context.cookies()).find((c) => c.name === "tailq-anon");
  expect(anon?.value).toMatch(/^[0-9a-f-]{36}$/);

  // 값이 있으면 다시 보내지 않는다
  let sent = false;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/events")) sent = true;
  });
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "이용약관" })).toBeVisible();
  expect(sent).toBe(false);
  expect(
    (await context.cookies()).find((c) => c.name === "tailq-anon")?.value,
  ).toBe(anon?.value);
});

test("브라우저는 허용된 이벤트만 보낼 수 있다", async ({ request }) => {
  const res = await request.post("/api/events", {
    data: { name: "answer_submit" },
  });
  expect(res.status()).toBe(400);
});
