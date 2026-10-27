import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { StreakTile } from "@/components/Streak";
import { loadProjectSession, startDailySession } from "@/lib/daily";
import { kstDay } from "@/lib/daily-pick";
import { loadStudy } from "@/lib/study";
import { createClient } from "@/lib/supabase/server";
import s from "../interview.module.css";
import { ShareButton } from "../ShareButton";
import { TurnRows } from "../TurnRows";

export const metadata: Metadata = { title: "오늘의 결과 · TailQ" };

// 오늘의 결과(docs/07 "오늘의 결과"). 세션이 끝난 뒤 페이지 이동으로 그린다(08 설계 "스트리밍 프로토콜").
// ?session=이 있으면 내 프로젝트 질문 세션의 결과다. 프로젝트 질문은 꼬리잇기에 들어가지 않아 꼬리잇기 칸이 없고,
// 닫기·두 번째 버튼은 프로젝트 질문 목록으로 간다.
export default function ResultPage({
  searchParams,
}: PageProps<"/interview/result">) {
  return (
    <Suspense>
      {searchParams.then((p) => (
        <SessionResult
          sessionId={typeof p.session === "string" ? p.session : undefined}
        />
      ))}
    </Suspense>
  );
}

async function SessionResult({ sessionId }: { sessionId?: string }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login?next=/interview/result");

  const session = sessionId
    ? await loadProjectSession(userId, sessionId)
    : await startDailySession(userId);
  if (!session) redirect(sessionId ? "/projects" : "/home");
  // 아직 진행 중이면 멈춘 곳으로
  if (session.status === "open") {
    redirect(sessionId ? `/interview?session=${sessionId}` : "/interview");
  }
  const back = sessionId ? `/projects/${session.question.projectId}` : "/home";

  const [{ data: turns }, { data: review }, study] = await Promise.all([
    supabase
      .from("turns")
      .select("idx, status, score, verdict, follow_up_prompt")
      .eq("session_id", session.id)
      .order("idx"),
    supabase
      .from("reviews")
      .select("box, due_day")
      .eq("question_id", session.question.id)
      .maybeSingle(),
    // 꼬리잇기를 못 읽어도 결과와 복습은 보여준다
    sessionId ? null : loadStudy().catch(() => null),
  ]);
  const streak = study?.streak.current;
  const q = session.question;
  const followed = (turns ?? []).some(
    (t) => t.idx > 0 && t.status === "graded",
  );
  const days =
    review &&
    (Date.parse(review.due_day) - Date.parse(kstDay(new Date()))) / 86_400_000;

  return (
    <div className={`${s.screen} ${s.summary} fade`}>
      <header className={s.summaryHeader}>
        <Link href={back} className="glass press icon-btn" aria-label="닫기">
          <Icon name="close" />
        </Link>
      </header>
      <span className={`${q.projectId ? "" : "mono"} ${s.tag}`}>
        {q.label} · {q.topic}
      </span>
      <h1 className={s.title}>
        {followed ? (
          <>
            {sessionId ? "프로젝트 질문," : "오늘 한 문제,"}
            <br />
            꼬리질문까지 마쳤어요
          </>
        ) : sessionId ? (
          "프로젝트 질문을 마쳤어요"
        ) : (
          "오늘 한 문제를 마쳤어요"
        )}
      </h1>

      <TurnRows turns={turns ?? []} prompt={q.prompt} />

      <section className={s.tiles}>
        {streak !== undefined && (
          <StreakTile
            days={streak}
            note={streak > 1 ? "하루 더 이어졌어요" : undefined}
          />
        )}
        {review && (
          <div className={`glass ${s.tile}`}>
            <span>다음 복습</span>
            <strong>{review.box ? `${days}일 뒤` : "익힌 질문이에요"}</strong>
            {review.box ? (
              <span className={`mono ${s.date}`}>
                {review.due_day.slice(5, 7)}/{review.due_day.slice(8, 10)}
              </span>
            ) : null}
          </div>
        )}
      </section>

      <div className={s.actions}>
        <ShareButton sessionId={session.id} />
        <Link href={back} className="glass btn btn-secondary press">
          {sessionId ? "질문 목록으로" : "홈으로"}
        </Link>
      </div>
    </div>
  );
}
