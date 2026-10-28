import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { limitNotice } from "@/components/LimitNotice";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadQuota } from "@/lib/usage";
import { DetailLoading, toQuestionRows } from "../../[id]/detail";
import { ProjectView } from "../../[id]/ProjectView";
import s from "@/app/(app)/projects/projects.module.css";

export const metadata: Metadata = { title: "학습 자료 질문 · TailQ" };

// 학습 자료 질문 목록(04 기능 명세 9번 "학습 자료", #141). 프로젝트 질문 목록(S24)과 같은 화면이다.
// 질문을 누르면 바로 연습하고, 삭제는 확인 창을 거친다. 만드는 동안은 학습 자료 행을 다시 읽는다
export default function NotePage({
  params,
}: PageProps<"/projects/notes/[id]">) {
  return (
    <div className={`${s.page} ${s.detail}`}>
      <Suspense fallback={<DetailLoading kind="note" />}>
        {params.then(({ id }) => (
          <Note id={id} />
        ))}
      </Suspense>
    </div>
  );
}

async function Note({ id }: { id: string }) {
  if (!z.uuid().safeParse(id).success) notFound();
  // RLS가 내 학습 자료와 그 질문·세션만 보여준다
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const [{ data: note }, quota] = await Promise.all([
    supabase
      .from("study_notes")
      .select(
        "id, title, status, questions(id, prompt, sessions(status, created_at, turns(idx, status, score, verdict)))",
      )
      .eq("id", id)
      .order("id", { referencedTable: "questions" })
      .maybeSingle()
      .throwOnError(),
    // 하루 한도·월 예산은 시작하기 전에 확인한다(04 기능 명세 12장)
    loadQuota(createAdminClient(), auth?.claims.sub ?? null),
  ]);
  if (!note) notFound();

  return (
    <ProjectView
      // 상태가 바뀌어 다시 읽으면 화면 상태를 처음부터 맞춘다
      key={note.status}
      kind="note"
      id={note.id}
      name={note.title}
      status={note.status as "generating" | "ready" | "failed"}
      questions={toQuestionRows(note.questions)}
      notice={limitNotice(quota, "practice")}
      canRetry={quota.budget !== "exceeded"}
    />
  );
}
