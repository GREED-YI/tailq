import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { LoadingStatus } from "@/components/LoadingStatus";
import { loadTrialSession } from "@/lib/server/trial-session";
import { turnResult } from "@/lib/server/turn";
import { createAdminClient } from "@/lib/supabase/admin";
import { MainResult } from "../../interview/MainResult";
import { SkeletonLines } from "../../interview/Skeleton";
import s from "../trial.module.css";

export const metadata: Metadata = { title: "체험 결과 · TailQ" };

// 체험 결과 + 가입 권유(Figma S03). 같은 날 이 브라우저에서 가입하면 이 체험이 첫 기록이 된다(04 기능 명세 10번).
// 로그인 없이 보는 화면이라 머리에는 로고만 둔다
export default function TrialResultPage() {
  return (
    <div className={`${s.page} fade`}>
      <header className={s.header}>
        <div className={s.headerIn}>
          <Link href="/" className={s.logo} aria-label="TailQ 처음으로">
            <Logo height="var(--logo-h)" />
          </Link>
        </div>
      </header>
      <main className={s.main}>
        <Suspense
          fallback={
            <>
              <LoadingStatus />
              <SkeletonLines />
            </>
          }
        >
          <TrialResult />
        </Suspense>
      </main>
    </div>
  );
}

async function TrialResult() {
  const session = await loadTrialSession();
  if (!session) redirect("/#try");
  if (session.status === "open") redirect("/trial");

  // 체험은 본 질문 채점이 끝나야 닫힌다. 쿠키로 이 브라우저의 세션임을 확인했으므로 모범 답안을 꺼낸다
  // (08 설계 "모범 답안과 기대 답안 보호")
  const [main, followUp] = session.turns;
  if (!main?.id) redirect("/#try");
  const result = await turnResult(createAdminClient(), main.id);
  const q = session.question;

  return (
    <>
      <div className={s.hero}>
        <span className="tag tag-neutral">체험 결과</span>
        <h1 className={s.title}>
          지금 가입하면 이 기록이
          <br />첫 기록이 돼요
        </h1>
      </div>

      <div className={s.meta}>
        <span className={`mono ${s.tag}`}>
          {q.label} · {q.topic}
        </span>
        <strong className={s.prompt}>{q.prompt}</strong>
      </div>

      {/* 채점 결과 묶음은 면접·기록 상세와 같다(#189). 꼬리질문을 풀었는지는 점수 막대 아래 한 줄로 */}
      <MainResult result={result}>
        {followUp?.effective_status === "graded" && (
          <span className={s.note}>꼬리질문 1개까지 풀었어요</span>
        )}
      </MainResult>

      {/* 요약 타일(DESIGN.md stat-tiles) 한 칸: 꼬리잇기 */}
      <section className={s.tile} aria-label="꼬리잇기">
        <span className={s.tileLabel}>꼬리잇기</span>
        <p className={s.tileNum}>
          <span className="mono">1</span>
          <span>일째</span>
        </p>
        <p className={s.tileNote}>
          꼬리잇기는 하루도 빠지지 않고 이어서 푼 날 수예요.
          <br />
          질문은 점수에 맞춰 다시 물어요.
        </p>
      </section>

      <div className={s.actions}>
        <Link href="/login" className="btn btn-primary press">
          가입하고 이어가기
        </Link>
        <Link href="/" className="btn btn-secondary press">
          나중에
        </Link>
      </div>
    </>
  );
}
