import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { FloatingQ } from "@/components/FloatingQ";
import { StreakTile } from "@/components/Streak";
import streakStyles from "@/components/Streak.module.css";
import { startDailySession } from "@/lib/daily";
import { loadStudy } from "@/lib/study";
import { createClient } from "@/lib/supabase/server";
import { weaknessReport } from "@/lib/weakness";

// 홈 뼈대. 오늘의 질문 카드에서 면접 화면으로 들어간다. 통계·인사는 각 이슈에서 채운다.
export default function HomePage() {
  return (
    <>
      <AppHeader />
      <h1
        style={{
          marginTop: 8,
          fontSize: 28,
          lineHeight: "36px",
          fontWeight: 700,
          letterSpacing: -0.8,
        }}
      >
        오늘도 한 문제
        <br />
        도전해 볼까요?
      </h1>
      <section
        className="glass"
        aria-label="오늘의 질문"
        style={{
          marginTop: 20,
          borderRadius: 32,
          padding: "22px 20px 20px",
          minHeight: 320,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", right: 14, top: 16 }}>
          <FloatingQ />
        </div>
        <div style={{ flex: 1 }} />
        <Suspense fallback={<TodayCard />}>
          <TodayQuestion />
        </Suspense>
      </section>
      {/* 3칸 통계(docs/07 "홈"). 다시 나올 질문 칸은 그 이슈에서 붙인다 */}
      <section
        aria-label="통계"
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <Suspense
          fallback={<div className="glass" style={{ borderRadius: 22 }} />}
        >
          <HomeStats />
        </Suspense>
      </section>
    </>
  );
}

// 꼬리잇기·약한 주제를 못 읽어도 홈의 오늘의 질문은 보여준다
async function HomeStats() {
  const study = await loadStudy().catch(() => null);
  if (!study) return null;
  // 약점 리포트와 같은 기준으로 가장 약한 주제(08 설계). 없으면 데이터가 모이는 중
  const weakest = weaknessReport(study.attempts, study.today).topics[0];
  return (
    <>
      <StreakTile days={study.streak.current} />
      <div className={`glass ${streakStyles.tile}`} style={{ gridColumn: 3 }}>
        <span className={streakStyles.label}>약한 주제</span>
        {weakest ? (
          <strong style={{ fontSize: 13, lineHeight: "18px" }}>
            {weakest.topic}
          </strong>
        ) : (
          <span className={streakStyles.note}>데이터가 모이는 중</span>
        )}
      </div>
    </>
  );
}

// 홈을 열면 오늘의 세션을 연다(08 설계 "오늘의 질문 세션")
async function TodayQuestion() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const session = userId ? await startDailySession(userId) : null;
  if (!session) {
    return (
      <TodayCard text="범위 안의 새 질문을 다 풀었어요. 범위를 넓혀볼까요?" />
    );
  }
  const q = session.question;
  return (
    <>
      <span
        className="mono"
        style={{ fontSize: 12, color: "var(--accent)", position: "relative" }}
      >
        Q.{String(q.id).padStart(3, "0")} · {q.field} / {q.topicId}
      </span>
      <p
        style={{
          marginTop: 8,
          fontSize: 20,
          lineHeight: "28px",
          fontWeight: 700,
          position: "relative",
        }}
      >
        {q.prompt}
      </p>
      <Link
        href="/interview"
        className="btn btn-primary press"
        style={{ marginTop: 20, width: "100%" }}
      >
        시작하기
      </Link>
    </>
  );
}

function TodayCard({ text = "오늘의 질문을 준비하고 있어요" }) {
  return (
    <>
      <p style={{ fontSize: 15, color: "var(--sub)", position: "relative" }}>
        {text}
      </p>
      <button
        type="button"
        className="btn"
        disabled
        style={{ marginTop: 20, width: "100%" }}
      >
        시작하기
      </button>
    </>
  );
}
