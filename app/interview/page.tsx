import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { startDailySession } from "@/lib/daily";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { turnResult } from "@/lib/turn";
import { Interview, type InterviewStatus } from "./Interview";

export const metadata: Metadata = { title: "면접 · TailQ" };

// 면접 화면(오늘의 질문 본 질문). 탭바·사이드 메뉴 없이 한 화면이다(docs/07 "PC·태블릿 앱").
// 로그인·온보딩 여부에 따른 이동은 proxy.ts가 한다.
export default function InterviewPage() {
  return (
    <Suspense>
      <TodayInterview />
    </Suspense>
  );
}

async function TodayInterview() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login?next=/interview");

  const session = await startDailySession(userId);
  if (!session) redirect("/home");

  // RLS가 자기 세션의 턴만 보여준다. 멈춘 채점은 effective_status가 failed다
  const [{ data: turn }, { data: profile }] = await Promise.all([
    supabase
      .from("turn_states")
      .select("id, effective_status, answer, grading_attempts")
      .eq("session_id", session.id)
      .eq("idx", 0)
      .single(),
    supabase.from("profiles").select("nickname").maybeSingle(),
  ]);
  if (!turn?.id) redirect("/home");

  const status = turn.effective_status as InterviewStatus;
  const result =
    status === "graded" ? await turnResult(createAdminClient(), turn.id) : null;

  return (
    <Interview
      // 서버 상태가 바뀌면(다시 읽기) 화면 상태를 처음부터 다시 맞춘다
      key={`${turn.id}:${status}:${turn.grading_attempts}`}
      turnId={turn.id}
      question={session.question}
      nickname={profile?.nickname ?? ""}
      initialStatus={status}
      initialAnswer={turn.answer ?? ""}
      initialResult={result}
    />
  );
}
