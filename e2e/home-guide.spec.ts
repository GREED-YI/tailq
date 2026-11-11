import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login, supabase } from "./login";

// 그날 질문을 다 푼 홈에는 첫 방문 안내를 그리지 않는다(#167). 로그인한 화면이라 로컬 Supabase가 있을 때만 돈다
test.skip(!supabase, "로컬 Supabase가 있어야 로그인한 화면을 본다");

const EMAIL = "e2e-guide167-done@example.test";

const db = () =>
  createClient(supabase!.url, supabase!.serviceKey, {
    auth: { persistSession: false },
  });
const kstToday = () =>
  new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

let me = "";
let question = 0;

test.beforeEach(async ({ context }) => {
  me = (await login(context, EMAIL)).user.id;
  await db().from("sessions").delete().eq("user_id", me);
});

test.afterAll(async () => {
  await db().from("sessions").delete().eq("user_id", me);
  if (question) await db().from("questions").delete().eq("id", question);
});

test("오늘 완료 홈에는 첫 방문 안내가 없다", async ({ page }) => {
  const admin = db();
  // 질문 은행 시드가 없는 DB에서도 돌게 이 테스트 전용 질문을 만들고 끝나면 지운다
  const { data: topic } = await admin
    .from("topics")
    .select("id")
    .limit(1)
    .single()
    .throwOnError();
  const { data: q } = await admin
    .from("questions")
    .insert({
      prompt: "[e2e] 오늘 완료 홈 확인용 질문",
      topic_id: topic.id,
      level: "basic",
    })
    .select("id")
    .single()
    .throwOnError();
  question = q.id;
  const { data: s } = await admin
    .from("sessions")
    .insert({
      user_id: me,
      question_id: q.id,
      kind: "daily",
      pick: "new",
      day: kstToday(),
      status: "done",
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single()
    .throwOnError();
  await admin
    .from("turns")
    .insert({
      session_id: s.id,
      idx: 0,
      answer: "다 풀었어요",
      status: "graded",
      score: 70,
      answered_at: new Date().toISOString(),
    })
    .throwOnError();

  await page.goto("/home");
  await expect(page.getByText("오늘 완료", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("note", { name: "TailQ는 이렇게 써요" }),
  ).toHaveCount(0);
});
