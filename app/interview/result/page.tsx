import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { StreakTile } from "@/components/Streak";
import { startDailySession } from "@/lib/daily";
import { kstDay } from "@/lib/daily-pick";
import { loadStudy } from "@/lib/study";
import { createClient } from "@/lib/supabase/server";
import s from "../interview.module.css";
import { TurnRows } from "../TurnRows";

export const metadata: Metadata = { title: "오늘의 결과 · TailQ" };

// 오늘의 결과(docs/07 "오늘의 결과"). 세션이 끝난 뒤 페이지 이동으로 그린다(08 설계 "스트리밍 프로토콜").
// 공유는 결과 공유 카드(#41)에서 붙인다.
export default function ResultPage() {
  return (
    <Suspense>
      <TodayResult />
    </Suspense>
  );
}

async function TodayResult() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login?next=/interview/result");

  const session = await startDailySession(userId);
  if (!session) redirect("/home");
  // 아직 진행 중이면 멈춘 곳으로
  if (session.status === "open") redirect("/interview");

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
    loadStudy(),
  ]);
  const streak = study.streak.current;
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
        <Link href="/home" className="glass press icon-btn" aria-label="닫기">
          <Icon name="close" />
        </Link>
      </header>
      <span className={`mono ${s.tag}`}>
        Q.{String(q.id).padStart(3, "0")} · {q.field} / {q.topicId}
      </span>
      <h1 className={s.title}>
        {followed ? (
          <>
            오늘 한 문제,
            <br />
            꼬리질문까지 마쳤어요
          </>
        ) : (
          "오늘 한 문제를 마쳤어요"
        )}
      </h1>

      <TurnRows turns={turns ?? []} prompt={q.prompt} />

      <section className={s.tiles}>
        <StreakTile
          days={streak}
          note={streak > 1 ? "하루 더 이어졌어요" : undefined}
        />
        {review && (
          <div className={`glass ${s.tile}`}>
            <span>다음 복습</span>
            <strong>{review.box ? `${days}일 뒤` : "익힌 질문이에요"}</strong>
          </div>
        )}
      </section>

      <div className={s.actions}>
        {/* 공유 카드는 결과 공유 이슈(#41)에서 붙인다. 그때까지 비활성 */}
        <button type="button" className="btn btn-primary" disabled>
          결과 공유하기
        </button>
        <Link href="/home" className={s.textBtn}>
          홈으로
        </Link>
      </div>
    </div>
  );
}
