import { expect, test } from "@playwright/test";

test("운영자가 아니면 운영 대시보드는 로그인으로도 보내지 않고 404다", async ({
  page,
}) => {
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
  await expect(page).toHaveURL("/admin");
  await expect(page.getByText("운영 대시보드")).toHaveCount(0);
  // 브라우저 제목으로도 운영 화면임을 알리지 않는다
  await expect(page).not.toHaveTitle(/운영/);
});

test("운영자가 아니면 피드백 목록도 404이고 제목에 운영이 없다", async ({
  page,
}) => {
  // 운영자 확인이 Suspense 안이라 응답이 스트리밍되면 상태는 200일 수 있다(Next.js loading 문서 "Status Codes").
  // 상태 코드 대신 404 화면이 그려지고 피드백 내용이 보이지 않는지 본다
  await page.goto("/admin/feedback");
  await expect(page.getByText("페이지를 찾을 수 없어요")).toBeVisible();
  await expect(page.getByText("사용자 피드백")).toHaveCount(0);
  await expect(page).not.toHaveTitle(/운영/);
});
