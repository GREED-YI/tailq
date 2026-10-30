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

test.beforeEach(async ({ context }) => {
  me = (await login(context, EMAIL)).user.id;
  await db().from("sessions").delete().eq("user_id", me);
});

test.afterAll(async () => {
  await db().from("sessions").delete().eq("user_id", me);
});

test("오늘 완료 홈에는 첫 방문 안내가 없다", async ({ page }) => {
  const admin = db();
  const { data: q } = await admin
    .from("questions")
    .select("id")
    .is("project_id", null)
    .is("note_id", null)
    .eq("is_hidden", false)
    .limit(1)
    .single()
    .throwOnError();
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
