import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { loadProjectSession, sourceHref, startDailySession } from "@/lib/daily";
import { kstDay } from "@/lib/daily-pick";
import { daysUntil, dueLabel } from "@/lib/review";
import { loadStudy } from "@/lib/study";
import { createClient } from "@/lib/supabase/server";
import s from "../interview.module.css";
import { ScoreBar } from "../ScoreRing";
import { ShareButton } from "../ShareButton";
import { ResultSkeleton } from "../Skeleton";
import { TurnRows } from "../TurnRows";
import { VerdictMark } from "../VerdictMark";
import { scoreColor } from "../verdict";

export const metadata: Metadata = { title: "오늘의 결과 · TailQ" };

// 오늘의 결과(docs/07 "오늘의 결과"). 세션이 끝난 뒤 페이지 이동으로 그린다(08 설계 "스트리밍 프로토콜").
// ?session=이 있으면 내 프로젝트 질문 세션의 결과다. 프로젝트 질문은 꼬리잇기에 들어가지 않아 꼬리잇기 칸이 없고,
// 닫기·두 번째 버튼은 프로젝트 질문 목록으로 간다.
export default function ResultPage({
  searchParams,
}: PageProps<"/interview/result">) {
  return (
    <Suspense fallback={<ResultSkeleton />}>
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
  if (!session || session === "budget") {
    redirect(sessionId ? "/projects" : "/home");
  }
  // 아직 진행 중이면 멈춘 곳으로
  if (session.status === "open") {
    redirect(sessionId ? `/interview?session=${sessionId}` : "/interview");
  }
  const back = sessionId ? sourceHref(session.question) : "/home";

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

  const main = (turns ?? []).find((t) => t.idx === 0);
  const score =
    main?.status === "graded" && main.verdict !== "unknown"
      ? (main.score ?? 0)
      : undefined;

  return (
    <div className={`${s.screen} fade`}>
      <header className={s.header}>
        <div className={s.headerIn}>
          <Link href={back} className="press icon-btn" aria-label="닫기">
            <Icon name="close" />
          </Link>
          <span className={`mono ${s.headerDate}`}>
            {kstDay(new Date()).replaceAll("-", ".")}
          </span>
        </div>
      </header>

      <main className={s.summaryMain}>
        <div className={s.hero}>
          <div className={s.heroMeta}>
            {/* today 라벨은 오늘의 질문에만. 프로젝트·학습 자료 질문은 neutral(DESIGN.md label) */}
            <span className={`tag ${sessionId ? "tag-neutral" : "tag-today"}`}>
              {sessionId
                ? q.noteId
                  ? "학습 자료 질문"
                  : "프로젝트 질문"
                : "오늘의 결과"}
            </span>
            <span className={q.projectId || q.noteId ? "" : "mono"}>
              {q.label} · {q.topic}
            </span>
          </div>
          <h1 className={s.title}>
            {/* 오늘의 질문은 꼬리질문까지 했는지와 상관없이 수고를 건넨다. 처음엔 "오늘 한 문제, 꼬리질문까지
                마쳤어요"였는데 딱딱한 완료 보고처럼 읽혀 바꿨다(2026-10-27) */}
            {!sessionId ? (
              <>
                오늘 면접도
                <br />
                고생 많았어요
              </>
            ) : followed ? (
              <>
                프로젝트 질문,
                <br />
                꼬리질문까지 마쳤어요
              </>
            ) : (
              "프로젝트 질문을 마쳤어요"
            )}
          </h1>
        </div>

        {/* 요약 타일(DESIGN.md stat-tiles result): 본 질문 점수 · 꼬리잇기 · 다음 복습. 없는 칸은 뺀다 */}
        <section className={s.tiles} aria-label="오늘 요약">
          {main?.status === "graded" && (
            <div className={s.tile}>
              <span className={s.tileLabel}>본 질문 점수</span>
              {/* 모르겠어요는 점수 대신 –와 빈 막대, 아래에 모르겠어요 판정(면접 화면 점수 패널과 같다) */}
              <p
                className={s.tileNum}
                role="img"
                aria-label={
                  score === undefined ? "점수 없음" : `100점 만점에 ${score}점`
                }
              >
                <span
                  className="mono"
                  style={
                    score === undefined
                      ? undefined
                      : { color: scoreColor(score) }
                  }
                >
                  {score ?? "–"}
                </span>
                <span className="mono">/100</span>
              </p>
              <ScoreBar value={score ?? 0} small />
              {score === undefined && (
                <span className={s.tileNote}>
                  <VerdictMark verdict="unknown" />
                </span>
              )}
            </div>
          )}
          {streak !== undefined && (
            <div className={s.tile}>
              <span className={s.tileLabel}>꼬리잇기</span>
              <p className={s.tileNum}>
                <span className="mono">{streak}</span>
                <span className={s.unit}>{streak > 0 ? "일째" : "일"}</span>
              </p>
              {streak > 1 && (
                <span className={s.tileNote} data-accent>
                  하루 더 이어졌어요
                </span>
              )}
            </div>
          )}
          {review && (
            <div className={s.tile}>
              <span className={s.tileLabel}>다음 복습</span>
              {/* "10/30"은 점수처럼 읽혀 "3일 뒤 다시 · 10월 30일(목)"로 쓴다(2026-10-27) */}
              <p className={s.tileText}>
                {review.box
                  ? dueLabel(daysUntil(review.due_day, kstDay(new Date())))
                  : "복습 완료한 질문이에요"}
              </p>
              {review.box ? (
                <span className={`num ${s.tileNote}`}>
                  {dayLabel(review.due_day)}
                </span>
              ) : null}
            </div>
          )}
        </section>

        <TurnRows turns={turns ?? []} prompt={q.prompt} />

        <div className={s.actions}>
          <ShareButton sessionId={session.id} />
          <Link href={back} className="btn btn-primary press">
            {sessionId ? "질문 목록으로" : "홈으로"}
          </Link>
        </div>
      </main>
    </div>
  );
}

// "2026-10-30" → "10월 30일(목)"
function dayLabel(day: string) {
  const [, m, d] = day.split("-").map(Number);
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  return `${m}월 ${d}일(${"일월화수목금토"[dow]})`;
}
