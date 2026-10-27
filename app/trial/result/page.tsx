import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import f from "@/components/Flow.module.css";
import { Logo } from "@/components/Logo";
import { StreakDays } from "@/components/Streak";
import { loadTrialSession } from "@/lib/trial-session";
import { ScoreRing } from "../../interview/ScoreRing";
import s from "../trial.module.css";

export const metadata: Metadata = { title: "체험 결과 · TailQ" };

// 체험 결과 + 가입 권유(Figma S03). 같은 날 이 브라우저에서 가입하면 이 체험이 첫 기록이 된다(04 기능 명세 10번)
export default function TrialResultPage() {
  return (
    <main className={f.main}>
      <span className={f.pcLogo}>
        <Logo />
      </span>
      <Suspense>
        <TrialResult />
      </Suspense>
    </main>
  );
}

type Feedback = { good?: string[]; improve?: string[] } | null;

async function TrialResult() {
  const session = await loadTrialSession();
  if (!session) redirect("/#try");
  if (session.status === "open") redirect("/trial");

  const [main, followUp] = session.turns;
  const score = main?.score ?? 0;
  const fb = main?.feedback as Feedback;
  const good = fb?.good?.[0];
  const improve = fb?.improve?.[0];
  const q = session.question;

  return (
    <>
      <header className={f.top}>
        <h1 className={f.topTitle}>체험 결과</h1>
      </header>

      <section className={`glass ${s.card}`} aria-label="채점 결과">
        <div className={s.head}>
          <ScoreRing
            shown={score}
            value={score}
            label={`100점 만점에 ${score}점`}
          />
          <div className={s.meta}>
            <span className={`mono ${s.tag}`}>
              {q.label} · {q.topic}
            </span>
            <strong className={s.prompt}>{q.prompt}</strong>
            {followUp?.effective_status === "graded" && (
              <span className={s.note}>꼬리질문 1개까지 풀었어요</span>
            )}
          </div>
        </div>
        {good && (
          <div className={s.point}>
            <span className={s.good}>잘한 점</span>
            <p>{good}</p>
          </div>
        )}
        {improve && (
          <div className={s.point}>
            <span className={s.improve}>보완할 점</span>
            <p>{improve}</p>
          </div>
        )}
      </section>

      <h2 className={s.pitch}>
        지금 가입하면 이 기록이
        <br />첫 기록이 돼요
      </h2>

      <section className={`glass ${s.streak}`} aria-label="꼬리잇기">
        <span className={s.streakLabel}>꼬리잇기</span>
        <strong className={s.streakValue}>
          <StreakDays days={1} />
        </strong>
        <p className={s.streakNote}>
          꼬리잇기는 매일 이어서 푼 날 수예요.
          <br />
          보완할 질문은 며칠 뒤 다시 나와요.
        </p>
      </section>

      <div className={f.bottom}>
        <Link href="/login" className="btn btn-primary press">
          가입하고 이어가기
        </Link>
        <Link href="/" className="glass btn btn-secondary press">
          나중에
        </Link>
      </div>
    </>
  );
}
