import { expect, test } from "@playwright/test";

test("로그인하지 않고 오늘의 질문 세션을 만들 수 없다", async ({ request }) => {
  const res = await request.post("/api/sessions", { data: { kind: "daily" } });
  expect(res.status()).toBe(401);
  expect(await res.json()).toEqual({
    error: { code: "UNAUTHORIZED", message: "로그인이 필요해요." },
  });
});
