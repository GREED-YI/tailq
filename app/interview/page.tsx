import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  loadProjectSession,
  sourceHref,
  startDailySession,
} from "@/lib/server/daily";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { turnResult } from "@/lib/server/turn";
import { pickPrevious } from "@/lib/previous";
import { Interview, type InterviewStatus } from "./Interview";
import { InterviewSkeleton } from "./Skeleton";
import { steps } from "./steps";

export const metadata: Metadata = { title: "면접 · TailQ" };

// 면접 화면(본 질문 → 꼬리질문). 탭바·사이드 메뉴 없이 한 화면이다(docs/07 "PC·태블릿 앱").
// 주소에 ?session=이 있으면 내 프로젝트 질문 세션, 없으면 오늘의 질문 세션이다.
// 로그인·온보딩 여부에 따른 이동은 proxy.ts가 한다.
export default function InterviewPage({
  searchParams,
}: PageProps<"/interview">) {
  return (
    <Suspense fallback={<InterviewSkeleton />}>
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
  // 월 예산에 닿아 오늘 세션을 새로 열 수 없으면 홈이 안내한다.
  // 연습 세션을 못 찾으면(자료와 함께 지워졌거나 잘못된 주소) 어느 구획 것인지 알 수 없어 Q메이커 첫 구획으로
  if (!session || session === "budget") {
    redirect(sessionId ? "/projects" : "/home");
  }
  const projectHref = sessionId && sourceHref(session.question);

  // 이어하기: 턴마다 저장하므로 가장 마지막 턴(본 질문 또는 꼬리질문)부터 이어간다(08 설계 "이어하기").
  // RLS가 자기 세션의 턴만 보여준다. 멈춘 채점은 effective_status가 failed다
  // 앞 단계들은 왼쪽 "지금까지" 흐름에 쓴다
  const [
    { data: turns },
    { data: profile },
    { data: bookmark },
    { data: past },
  ] = await Promise.all([
    supabase
      .from("turn_states")
      .select(
        "id, idx, follow_up_prompt, effective_status, answer, grading_attempts, score, verdict",
      )
      .eq("session_id", session.id)
      .order("idx"),
    supabase.from("profiles").select("nickname").maybeSingle(),
    supabase
      .from("bookmarks")
      .select("question_id")
      .eq("question_id", session.question.id)
      .maybeSingle(),
    // 복습이면 같은 질문의 지난 본 질문 기록(#131). 오늘의 질문에만 보인다.
    // RLS 클라이언트로 읽어 내 세션만 나온다. 관리자 클라이언트를 쓰면 같은 은행 질문에 답한 다른 사람의 답이 섞인다.
    // 고르는 규칙(오늘 제외·끝난 세션·채점된 본 질문)은 pickPrevious가 한다. 같은 질문을 푼 횟수만큼만 온다
    sessionId
      ? { data: null }
      : supabase
          .from("sessions")
          .select(
            "id, day, status, turns(idx, status, answer, score, verdict, feedback)",
          )
          .eq("user_id", userId)
          .eq("question_id", session.question.id)
          .eq("turns.idx", 0)
          .order("day", { ascending: false })
          .order("created_at", { ascending: false }),
  ]);
  const turn = turns?.at(-1);
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
      initialSteps={steps(turns ?? [], session.question.prompt)}
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
      previous={past && pickPrevious(past, session.id)}
    />
  );
}
