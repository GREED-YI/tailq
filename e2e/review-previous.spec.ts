import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login, supabase } from "./login";

// 복습할 때 지난 답과 점수 변화(#131). 로그인한 화면이라 로컬 Supabase가 있을 때만 돈다.
// 데이터는 이 테스트 전용 계정 둘에만 만든다(A: 푸는 사람, B: 같은 질문을 푼 다른 사람)
test.skip(!supabase, "로컬 Supabase가 있어야 로그인한 화면을 본다");

const EMAIL = "e2e-review131@example.test";
const OTHER = "e2e-review131-other@example.test";
const MY_ANSWER = "배열은 인덱스로 바로 접근하고 연결 리스트는 노드를 따라가요";
const OTHER_ANSWER = "다른 사람이 쓴 답이라 보이면 안 돼요";
const ANSWER =
  "배열은 연속된 메모리라 인덱스 접근이 O(1)이고, 연결 리스트는 삽입과 삭제가 빨라요.";

const db = () =>
  createClient(supabase!.url, supabase!.serviceKey, {
    auth: { persistSession: false },
  });
// 한국 날짜 "YYYY-MM-DD", n일 전
const kstDay = (n = 0) =>
  new Date(Date.now() + 9 * 3_600_000 - n * 86_400_000)
    .toISOString()
    .slice(0, 10);

async function userId(email: string) {
  const admin = db();
  await admin.auth.admin.createUser({ email, email_confirm: true });
  const { data } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  return data.user!.id;
}

// 은행 질문 둘(모범 답안이 있어야 채점된다)
async function bankQuestions() {
  const { data } = await db()
    .from("question_keys")
    .select("question_id, questions!inner(project_id, note_id, is_hidden)")
    .is("questions.project_id", null)
    .is("questions.note_id", null)
    .eq("questions.is_hidden", false)
    .order("question_id")
    .limit(2)
    .throwOnError();
  return data.map((r) => r.question_id);
}

// 끝난 세션 하나와 채점된 본 질문 턴
async function pastSession(
  user: string,
  questionId: number,
  day: string,
  score: number,
  answer: string,
) {
  const admin = db();
  const { data: s } = await admin
    .from("sessions")
    .insert({
      user_id: user,
      question_id: questionId,
      kind: "daily",
      pick: "new",
      day,
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
      answer,
      status: "graded",
      score,
      answered_at: new Date().toISOString(),
      feedback: {
        summary: "접근 비용은 짚었지만 캐시 지역성이 빠졌어요",
        good: [],
        improve: [],
        missing_keywords: ["캐시 지역성"],
      },
    })
    .throwOnError();
  return s.id;
}

// 오늘의 질문 세션(본 질문 답변 단계)
async function todaySession(user: string, questionId: number) {
  const admin = db();
  const { data: s } = await admin
    .from("sessions")
    .insert({
      user_id: user,
      question_id: questionId,
      kind: "daily",
      pick: "review",
      day: kstDay(),
    })
    .select("id")
    .single()
    .throwOnError();
  await admin.from("turns").insert({ session_id: s.id, idx: 0 }).throwOnError();
}

let me = "";
let other = "";
let accessToken = "";
let questions: number[] = [];

test.beforeAll(async () => {
  other = await userId(OTHER);
  questions = await bankQuestions();
});

test.beforeEach(async ({ context }) => {
  const session = await login(context, EMAIL);
  me = session.user.id;
  accessToken = session.access_token;
  await db().from("sessions").delete().in("user_id", [me, other]);
});

test.afterAll(async () => {
  await db().from("sessions").delete().in("user_id", [me, other]);
});

test("복습 질문은 지난번 답이 접힌 채 보이고, 채점 뒤 점수 변화가 보인다", async ({
  page,
}) => {
  const [q] = questions;
  await pastSession(me, q, kstDay(7), 62, MY_ANSWER);
  // 같은 질문을 더 최근에 푼 다른 사람
  const otherId = await pastSession(other, q, kstDay(1), 90, OTHER_ANSWER);
  await todaySession(me, q);

  await page.goto("/interview");
  const summary = page.locator("summary", { hasText: "지난번 답 보기" });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(kstDay(7).replaceAll("-", "."));
  await expect(summary).toContainText("62");
  // 처음엔 접혀 있다
  await expect(page.getByText(MY_ANSWER)).toBeHidden();

  await summary.click();
  await expect(page.getByText(MY_ANSWER)).toBeVisible();
  await expect(
    page.getByText("접근 비용은 짚었지만 캐시 지역성이 빠졌어요"),
  ).toBeVisible();
  // 보완할 개념은 정답 힌트라 넣지 않는다
  await expect(page.getByText("캐시 지역성", { exact: true })).toHaveCount(0);
  await expect(page.getByText(OTHER_ANSWER)).toHaveCount(0);

  await page.getByLabel("내 답변").fill(ANSWER);
  await page.getByRole("button", { name: "제출하기" }).click();
  const panel = page.getByRole("region", { name: "채점 결과" });
  // 가짜 채점은 74점
  await expect(panel.getByText("+12")).toBeVisible();
  // 보이는 줄은 화면 읽기에서 빼고(점수 뒤 "점"은 화면 읽기 글자) 문장 하나로 읽힌다
  await expect(panel.locator('p[aria-hidden="true"]')).toHaveText(
    /^지난번62점?→오늘74점?\+12$/,
  );
  await expect(
    panel.getByText("지난번 62점, 오늘 74점이에요. 12점 올랐어요."),
  ).toBeAttached();
  // 결과 화면에는 지난번 답 접힘이 없다
  await expect(summary).toHaveCount(0);

  // RLS: 내 권한으로는 user_id 조건 없이 읽어도 다른 사람의 세션이 나오지 않는다
  const { data } = await createClient(supabase!.url, supabase!.anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
    .from("sessions")
    .select("id, user_id, turns(answer)")
    .eq("question_id", q)
    .throwOnError();
  expect(data.length).toBeGreaterThan(0);
  expect(data.every((s) => s.user_id === me)).toBe(true);
  expect(data.some((s) => s.id === otherId)).toBe(false);
});

test("새 질문에는 지난번 답도 점수 변화도 없다", async ({ page }) => {
  const [q, fresh] = questions;
  // 다른 질문의 기록과 다른 사람의 같은 질문 기록은 지난번이 아니다
  await pastSession(me, q, kstDay(7), 62, MY_ANSWER);
  await pastSession(other, fresh, kstDay(1), 90, OTHER_ANSWER);
  await todaySession(me, fresh);

  await page.goto("/interview");
  await expect(page.getByLabel("내 답변")).toBeVisible();
  await expect(page.getByText("지난번 답 보기")).toHaveCount(0);

  await page.getByLabel("내 답변").fill(ANSWER);
  await page.getByRole("button", { name: "제출하기" }).click();
  const panel = page.getByRole("region", { name: "채점 결과" });
  await expect(
    panel.getByRole("img", { name: "100점 만점에 74점" }),
  ).toBeVisible();
  await expect(panel.getByText("지난번")).toHaveCount(0);
});
