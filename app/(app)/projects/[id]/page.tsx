import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ProjectView, type QuestionRow } from "./ProjectView";
import s from "../projects.module.css";

export const metadata: Metadata = { title: "프로젝트 질문 · TailQ" };

// 프로젝트 질문 목록(04 기능 명세 9번, S24). 질문을 누르면 바로 연습하고, 삭제는 확인 창(S25)을 거친다.
// 질문을 만드는 동안은 이 화면이 프로젝트 행을 다시 읽어 ready·failed가 됐는지 본다(08 설계 "내 프로젝트 질문 생성").
export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <div className={`${s.page} ${s.detail}`}>
      <Suspense>
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
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, status, questions(id, prompt, sessions(status, created_at, turns(idx, status, score, verdict)))",
    )
    .eq("id", id)
    .order("id", { referencedTable: "questions" })
    .maybeSingle()
    .throwOnError();
  if (!project) notFound();

  const questions: QuestionRow[] = project.questions.map((q) => {
    // 가장 최근에 본 질문을 채점받은 세션의 점수. 없고 열린 세션이 있으면 "연습 중"
    const sessions = [...q.sessions].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    const main = sessions
      .map((ss) => ss.turns.find((t) => t.idx === 0))
      .find((t) => t?.status === "graded");
    return {
      id: q.id,
      prompt: q.prompt,
      state: main
        ? main.verdict === "unknown"
          ? "모르겠어요"
          : `${main.score}점`
        : sessions.some((ss) => ss.status === "open")
          ? "doing"
          : null,
    };
  });

  return (
    <ProjectView
      // 상태가 바뀌어 다시 읽으면 화면 상태를 처음부터 맞춘다
      key={project.status}
      id={project.id}
      name={project.name}
      status={project.status as "generating" | "ready" | "failed"}
      questions={questions}
    />
  );
}
