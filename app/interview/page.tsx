import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { loadProjectSession, startDailySession } from "@/lib/daily";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { turnResult } from "@/lib/turn";
import { Interview, type InterviewStatus } from "./Interview";

export const metadata: Metadata = { title: "면접 · TailQ" };

// 면접 화면(본 질문 → 꼬리질문). 탭바·사이드 메뉴 없이 한 화면이다(docs/07 "PC·태블릿 앱").
// 주소에 ?session=이 있으면 내 프로젝트 질문 세션, 없으면 오늘의 질문 세션이다.
// 로그인·온보딩 여부에 따른 이동은 proxy.ts가 한다.
export default function InterviewPage({
  searchParams,
}: PageProps<"/interview">) {
  return (
    <Suspense>
      {searchParams.then((p) => (
        <SessionInterview
          sessionId={typeof p.session === "string" ? p.session : undefined}
        />
      ))}
    </Suspense>
  );
}

async function SessionInterview({ sessionId }: { sessionId?: string }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    redirect(
      `/login?next=${encodeURIComponent(sessionId ? `/interview?session=${sessionId}` : "/interview")}`,
    );
  }

  const session = sessionId
    ? await loadProjectSession(userId, sessionId)
    : await startDailySession(userId);
  if (!session) redirect(sessionId ? "/projects" : "/home");
  const projectHref = sessionId && `/projects/${session.question.projectId}`;

  // 이어하기: 턴마다 저장하므로 가장 마지막 턴(본 질문 또는 꼬리질문)부터 이어간다(08 설계 "이어하기").
  // RLS가 자기 세션의 턴만 보여준다. 멈춘 채점은 effective_status가 failed다
  const [{ data: turn }, { data: profile }, { data: bookmark }] =
    await Promise.all([
      supabase
        .from("turn_states")
        .select(
          "id, idx, follow_up_prompt, effective_status, answer, grading_attempts",
        )
        .eq("session_id", session.id)
        .order("idx", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("nickname").maybeSingle(),
      supabase
        .from("bookmarks")
        .select("question_id")
        .eq("question_id", session.question.id)
        .maybeSingle(),
    ]);
  if (!turn?.id || turn.idx === null) redirect(projectHref || "/home");

  const status = turn.effective_status as InterviewStatus;
  const result =
    status === "graded" ? await turnResult(createAdminClient(), turn.id) : null;

  return (
    <Interview
      // 서버 상태가 바뀌면(다시 읽기) 화면 상태를 처음부터 다시 맞춘다
      key={`${turn.id}:${status}:${turn.grading_attempts}`}
      initialTurn={{
        id: turn.id,
        idx: turn.idx,
        prompt: turn.follow_up_prompt ?? session.question.prompt,
      }}
      question={session.question}
      exitHref={projectHref || "/home"}
      resultHref={
        sessionId
          ? `/interview/result?session=${sessionId}`
          : "/interview/result"
      }
      nickname={profile?.nickname ?? ""}
      bookmarked={Boolean(bookmark)}
      initialStatus={status}
      initialAnswer={turn.answer ?? ""}
      initialResult={result}
    />
  );
}
