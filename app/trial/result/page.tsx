import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { loadTrialSession } from "@/lib/trial-session";
import { ScoreRing } from "../../interview/ScoreRing";
import { scoreVerdict } from "../../interview/verdict";
import { VerdictMark } from "../../interview/VerdictMark";
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
        <Suspense>
          <TrialResult />
        </Suspense>
      </main>
    </div>
  );
}

type Feedback = { good?: string[]; improve?: string[] } | null;

async function TrialResult() {
  const session = await loadTrialSession();
  if (!session) redirect("/#try");
  if (session.status === "open") redirect("/trial");

  const [main, followUp] = session.turns;
  const unknown = main?.verdict === "unknown";
  // 모르겠어요는 0점으로 기록되지만 점수 대신 –와 빈 막대로 보여준다
  const score = unknown ? undefined : (main?.score ?? 0);
  const fb = main?.feedback as Feedback;
  const good = fb?.good?.[0];
  const improve = fb?.improve?.[0];
  const q = session.question;

  return (
    <>
      <div className={s.hero}>
        <span className="tag tag-today">체험 결과</span>
        <h1 className={s.title}>
          지금 가입하면 이 기록이
          <br />첫 기록이 돼요
        </h1>
      </div>

      <section className={s.panel} aria-label="채점 결과">
        <div className={s.meta}>
          <span className={`mono ${s.tag}`}>
            {q.label} · {q.topic}
          </span>
          <strong className={s.prompt}>{q.prompt}</strong>
        </div>
        <ScoreRing
          shown={score ?? 0}
          value={score}
          label={score === undefined ? "점수 없음" : `100점 만점에 ${score}점`}
          empty="–"
          aside={
            <VerdictMark
              verdict={score === undefined ? "unknown" : scoreVerdict(score)}
            />
          }
        />
        {followUp?.effective_status === "graded" && (
          <span className={s.note}>꼬리질문 1개까지 풀었어요</span>
        )}
        {(good || improve) && (
          <div className={s.points}>
            {good && (
              <div className={s.point}>
                <span className={s.good}>잘한 점</span>
                <p>{good}</p>
              </div>
            )}
            {improve && (
              <div className={s.point}>
                <span>보완할 점</span>
                <p>{improve}</p>
              </div>
            )}
          </div>
        )}
      </section>

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
