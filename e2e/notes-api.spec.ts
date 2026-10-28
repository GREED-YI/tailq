import { expect, test } from "@playwright/test";

const unauthorized = {
  error: { code: "UNAUTHORIZED", message: "로그인이 필요해요." },
};

test("로그인하지 않고 학습 자료를 등록·다시 생성·삭제할 수 없다", async ({
  request,
}) => {
  const id = "14141000-0000-4000-8000-000000000001";
  const created = await request.post("/api/notes", {
    data: { title: "운영체제", content: "# 프로세스 ".repeat(10) },
  });
  expect(created.status()).toBe(401);
  expect(await created.json()).toEqual(unauthorized);

  const retried = await request.post(`/api/notes/${id}/generations`);
  expect(retried.status()).toBe(401);

  const deleted = await request.delete(`/api/notes/${id}`);
  expect(deleted.status()).toBe(401);
});

test("로그인하지 않고 학습 자료 등록에 오면 로그인으로 간다", async ({
  page,
}) => {
  await page.goto("/projects/notes/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fprojects%2Fnotes%2Fnew/);
});
