import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { limitNotice } from "@/components/LimitNotice";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadQuota, retryBlocked } from "@/lib/server/usage";
import { DetailLoading, toQuestionRows } from "./detail";
import { ProjectView } from "./ProjectView";
import s from "@/app/(app)/projects/projects.module.css";

export const metadata: Metadata = { title: "프로젝트 질문 · TailQ" };

// 프로젝트 질문 목록(04 기능 명세 9번, S24). 질문을 누르면 바로 연습하고, 삭제는 확인 창(S25)을 거친다.
// 질문을 만드는 동안은 이 화면이 프로젝트 행을 다시 읽어 ready·failed가 됐는지 본다(08 설계 "내 프로젝트 질문 생성").
export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <div className={`${s.page} ${s.detail}`}>
      <Suspense fallback={<DetailLoading />}>
        {params.then(({ id }) => (
          <Project id={id} />
        ))}
      </Suspense>
    </div>
  );
}

async function Project({ id }: { id: string }) {
  if (!z.uuid().safeParse(id).success) notFound();
  // RLS가 내 프로젝트와 그 질문·세션만 보여준다
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const [{ data: project }, quota] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, status, questions(id, prompt, sessions(status, created_at, turns(idx, status, score, verdict)))",
      )
      .eq("id", id)
      .order("id", { referencedTable: "questions" })
      .maybeSingle()
      .throwOnError(),
    // 하루 한도·월 예산은 시작하기 전에 확인한다(04 기능 명세 12장)
    loadQuota(createAdminClient(), auth?.claims.sub ?? null),
  ]);
  if (!project) notFound();

  return (
    <ProjectView
      // 상태가 바뀌어 다시 읽으면 화면 상태를 처음부터 맞춘다
      key={project.status}
      id={project.id}
      name={project.name}
      status={project.status as "generating" | "ready" | "failed"}
      questions={toQuestionRows(project.questions)}
      notice={limitNotice(quota, "practice")}
      sessionsLeft={quota.budget === "exceeded" ? null : quota.sessionsLeft}
      retryBlocked={retryBlocked(quota)}
    />
  );
}
