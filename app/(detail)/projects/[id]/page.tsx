import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Icon } from "@/components/icons";
import { limitNotice } from "@/components/LimitNotice";
import { LoadingStatus } from "@/components/LoadingStatus";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadQuota } from "@/lib/usage";
import { ProjectView, type QuestionRow } from "./ProjectView";
import s from "@/app/(app)/projects/projects.module.css";

export const metadata: Metadata = { title: "프로젝트 질문 · TailQ" };

// 프로젝트 질문 목록(04 기능 명세 9번, S24). 질문을 누르면 바로 연습하고, 삭제는 확인 창(S25)을 거친다.
// 질문을 만드는 동안은 이 화면이 프로젝트 행을 다시 읽어 ready·failed가 됐는지 본다(08 설계 "내 프로젝트 질문 생성").
export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <div className={`${s.page} ${s.detail}`}>
      <Suspense fallback={<Loading />}>
        {params.then(({ id }) => (
          <Project id={id} />
        ))}
      </Suspense>
    </div>
  );
}

// 불러오는 동안: 뒤로 버튼은 그대로, 이름 · 제목 · 질문 5줄은 같은 크기의 빈 칸으로(레이아웃이 밀리지 않게).
// 만드는 중 화면의 질문 자리(.skeleton)와 달리 움직이지 않는다
function Loading() {
  return (
    <>
      <LoadingStatus />
      <div aria-busy="true">
        <header className={s.top}>
          <Link
            href="/projects"
            className="press icon-btn"
            aria-label="내 프로젝트로"
          >
            <Icon name="chevronLeft" />
          </Link>
          <span className="skeleton" aria-hidden="true" />
        </header>
        <p className={s.title} aria-hidden="true">
          <span className="skeleton" style={{ width: "70%" }} />
        </p>
        <p className={s.desc} aria-hidden="true">
          <span className="skeleton" style={{ width: "50%" }} />
        </p>
        <ol className={`${s.rows} ${s.qRows}`} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className={`${s.row} ${s.qRow}`}>
              <span />
              <span>
                <span className={s.qPrompt}>
                  <span className="skeleton" />
                </span>
                <span className={s.qState}>
                  <span className="skeleton" style={{ width: "30%" }} />
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </>
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

  const questions: QuestionRow[] = project.questions.map((q) => {
    // 가장 최근에 본 질문을 채점받은 세션의 점수. 없고 열린 세션이 있으면 "연습 중"
    const sessions = [...q.sessions].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    const main = sessions
      .map((ss) => ss.turns.find((t) => t.idx === 0))
      .find((t) => t?.status === "graded");
    const open = sessions.some((ss) => ss.status === "open");
    return {
      id: q.id,
      prompt: q.prompt,
      open,
      score: main && main.verdict !== "unknown" ? main.score : null,
      state: main
        ? main.verdict === "unknown"
          ? "모르겠어요"
          : `${main.score}점`
        : open
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
      notice={limitNotice(quota, "practice")}
      canRetry={quota.budget !== "exceeded"}
    />
  );
}
