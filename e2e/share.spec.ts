import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test("로그인하지 않고 공유 카드를 만들 수 없다", async ({ request }) => {
  const res = await request.post("/api/shares", {
    data: { sessionId: "00000000-0000-0000-0000-000000000001" },
  });
  expect(res.status()).toBe(401);
});

test("없는 공유 링크는 랜딩으로 간다", async ({ page }) => {
  await page.goto("/s/not-a-share");
  await expect(page).toHaveURL("/");
});

// 카드를 실제로 만들어 보는 테스트는 로컬 Supabase(서버 전용 키)가 있을 때만 돈다.
// CI의 E2E는 DB 없이 돌아 건너뛴다(카드 규칙은 supabase/tests/shares_test.sql이 지킨다)
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
test.describe("공유 페이지", () => {
  test.skip(!serviceKey, "로컬 Supabase가 필요하다");

  const db = createClient("http://127.0.0.1:54321", serviceKey ?? "skip", {
    auth: { persistSession: false },
  });
  const QUESTION = 94160;
  let userId = "";
  let shareId = "";

  test.beforeAll(async () => {
    const { data: user } = await db.auth.admin.createUser({
      email: "share41-e2e@example.test",
      email_confirm: true,
      user_metadata: { name: "테일러" },
    });
    userId = user.user!.id;
    await db
      .from("questions")
      .insert({
        id: QUESTION,
        topic_id: "jpa",
        level: "mid",
        prompt: "E2E 공유",
      })
      .throwOnError();
    const { data: session } = await db
      .rpc("start_daily_session", {
        p_user_id: userId,
        p_question_id: QUESTION,
        p_pick: "new",
      })
      .single<{ id: string }>()
      .throwOnError();
    await db
      .from("turns")
      .update({
        status: "graded",
        score: 72,
        answered_at: new Date().toISOString(),
      })
      .eq("session_id", session.id)
      .eq("idx", 0)
      .throwOnError();
    const { data } = await db
      .rpc("create_share", {
        p_user_id: userId,
        p_session_id: session.id,
        p_streak: 12,
      })
      .throwOnError();
    shareId = data as string;
  });

  test.afterAll(async () => {
    if (userId) await db.auth.admin.deleteUser(userId);
    await db.from("questions").delete().eq("id", QUESTION);
  });

  test("로그인하지 않아도 카드와 나도 풀어보기가 보인다", async ({ page }) => {
    await page.goto(`/s/${shareId}`);
    const card = page.getByRole("region", { name: "결과 카드" });
    await expect(card.getByRole("heading", { name: "JPA" })).toBeVisible();
    await expect(
      card.getByRole("img", { name: "100점 만점에 72점" }),
    ).toBeVisible();
    await expect(card).toContainText("테일러 · 꼬리잇기12 일째");
    // 질문 원문은 내보내지 않는다
    await expect(page.getByText("E2E 공유")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "나도 한 문제 풀어보기" }),
    ).toHaveAttribute("href", "/#try");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      new RegExp(`/s/${shareId}/opengraph-image`),
    );
  });

  test("미리보기 이미지는 PNG로 온다", async ({ request }) => {
    const res = await request.get(`/s/${shareId}/opengraph-image`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    expect((await res.body()).subarray(1, 4).toString()).toBe("PNG");
  });
});
