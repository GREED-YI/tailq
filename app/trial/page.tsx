import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadTrialSession } from "@/lib/trial-session";
import { turnResult } from "@/lib/turn";
import { Interview, type InterviewStatus } from "../interview/Interview";

export const metadata: Metadata = { title: "체험 · TailQ" };

// 로그인 없는 체험(S03 앞의 세션 화면, S13~S16과 같은 면접 화면). 본 질문 → 꼬리질문 1개.
// 체험을 시작하지 않았으면 랜딩의 체험 칸으로, 끝났으면 체험 결과로 보낸다.
export default function TrialPage() {
  return (
    <Suspense>
      <TrialInterview />
    </Suspense>
  );
}

async function TrialInterview() {
  const session = await loadTrialSession();
  if (!session) redirect("/#try");
  if (session.status !== "open") redirect("/trial/result");

  // 이어하기: 가장 마지막 턴부터(08 설계 "이어하기")
  const turn = session.turns.at(-1);
  if (!turn?.id || turn.idx === null) redirect("/#try");
  const status = turn.effective_status as InterviewStatus;
  const result =
    status === "graded" ? await turnResult(createAdminClient(), turn.id) : null;

  return (
    <Interview
      key={`${turn.id}:${status}:${turn.grading_attempts}`}
      trial
      initialTurn={{
        id: turn.id,
        idx: turn.idx,
        prompt: turn.follow_up_prompt ?? session.question.prompt,
      }}
      question={session.question}
      exitHref="/"
      resultHref="/trial/result"
      nickname=""
      bookmarked={false}
      initialStatus={status}
      initialAnswer={turn.answer ?? ""}
      initialResult={result}
    />
  );
}
