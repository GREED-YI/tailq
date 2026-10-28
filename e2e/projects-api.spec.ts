import { expect, test } from "@playwright/test";

const unauthorized = {
  error: { code: "UNAUTHORIZED", message: "로그인이 필요해요." },
};

test("로그인하지 않고 프로젝트를 등록·다시 생성·삭제할 수 없다", async ({
  request,
}) => {
  const id = "39390000-0000-4000-8000-000000000001";
  const created = await request.post("/api/projects", {
    data: { name: "혜자", content: "README ".repeat(10) },
  });
  expect(created.status()).toBe(401);
  expect(await created.json()).toEqual(unauthorized);

  const retried = await request.post(`/api/projects/${id}/generations`);
  expect(retried.status()).toBe(401);

  const deleted = await request.delete(`/api/projects/${id}`);
  expect(deleted.status()).toBe(401);

  const session = await request.post("/api/sessions", {
    data: { kind: "project", questionId: 1 },
  });
  expect(session.status()).toBe(401);
});

test("로그인하지 않고 Q메이커에 오면 로그인으로 간다", async ({ page }) => {
  await page.goto("/projects/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fprojects%2Fnew/);
});
