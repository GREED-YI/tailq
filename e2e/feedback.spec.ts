import { expect, test } from "@playwright/test";

test("로그인하지 않으면 피드백 화면 대신 로그인으로 가고, 로그인 뒤 돌아온다", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "피드백 보내기" }).click();
  await expect(page).toHaveURL("/login?next=%2Fmy%2Ffeedback");
});

// 채점 결과의 "질문·채점이 이상해요"(#134)는 분류와 질문 번호를 쿼리로 넘긴다. 로그인을 거쳐도 쿼리가 남아야 미리 채워진다
test("신고 링크로 오면 로그인 뒤 같은 쿼리로 돌아온다", async ({
  page,
  request,
}) => {
  const target = "/my/feedback?category=report&q=225";
  await page.goto(target);
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(target)}`);
  await expect(page.locator('input[name="next"]').first()).toHaveValue(target);
  // 로그인 요청이 돌려보내는 주소에도 쿼리가 그대로 있다(소셜 로그인 없이 실패 경로로 확인)
  const res = await request.post("/auth/login", {
    form: { provider: "none", next: target },
    maxRedirects: 0,
  });
  const back = new URL(res.headers().location, "http://localhost");
  expect(back.searchParams.get("next")).toBe(target);
});

test("로그인하지 않고 피드백을 보낼 수 없다", async ({ request }) => {
  const res = await request.post("/api/feedback", {
    data: { body: "로그인 없이 보내 볼게요" },
  });
  expect(res.status()).toBe(401);
});

test("운영자가 아니면 피드백 목록은 404다", async ({ page }) => {
  // 운영자 확인이 Suspense 안이라 스트리밍되면 상태는 200일 수 있어 화면으로 본다(admin.spec.ts와 같다)
  await page.goto("/admin/feedback");
  await expect(page.getByText("페이지를 찾을 수 없어요")).toBeVisible();
  await expect(page.getByText("사용자 피드백")).toHaveCount(0);
  // 404 화면도 운영 화면도 검색에 잡히지 않는다. robots 메타가 둘 이상일 수 있어 noindex가 하나라도 있는지 본다
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]').first(),
  ).toBeAttached();
});
