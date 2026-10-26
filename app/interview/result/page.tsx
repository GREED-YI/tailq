import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { startDailySession } from "@/lib/daily";
import { kstDay } from "@/lib/daily-pick";
import { createClient } from "@/lib/supabase/server";
import s from "../interview.module.css";
import { VERDICTS } from "../verdict";

export const metadata: Metadata = { title: "오늘의 결과 · TailQ" };

// 오늘의 결과(docs/07 "오늘의 결과"). 세션이 끝난 뒤 페이지 이동으로 그린다(08 설계 "스트리밍 프로토콜").
// 꼬리잇기 칸은 꼬리잇기 계산(#36), 공유는 결과 공유 카드(#41)에서 붙인다.
export default function ResultPage() {
  return (
    <Suspense>
      <TodayResult />
    </Suspense>
  );
}

// 본 질문 점수 구간 색(docs/09 1장: 70점이 "잘 답함", 40점 미만은 핵심 대부분이 빠짐)
const scoreColor = (score: number) =>
  score >= 70 ? "var(--good)" : score >= 40 ? "var(--mid)" : "var(--low)";

async function TodayResult() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login?next=/interview/result");

  const session = await startDailySession(userId);
  if (!session) redirect("/home");
  // 아직 진행 중이면 멈춘 곳으로
  if (session.status === "open") redirect("/interview");

  const [{ data: turns }, { data: review }] = await Promise.all([
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
  ]);
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

      <ol className={`glass ${s.rows}`} aria-label="단계별 결과">
        {(turns ?? []).map((t) => {
          // 본 질문은 점수, 꼬리질문은 판정. 날짜를 넘겨 닫힌 꼬리질문은 건너뜀
          const v = t.verdict ? VERDICTS[t.verdict] : null;
          const color = v
            ? v.color
            : t.status === "graded"
              ? scoreColor(t.score ?? 0)
              : "var(--dot-off)";
          return (
            <li key={t.idx} className={s.rowItem}>
              <span
                className={s.verdictDot}
                style={{ background: color }}
                aria-hidden="true"
              />
              <div className={s.rowText}>
                <span className="mono">
                  {t.idx === 0 ? "본 질문" : `꼬리질문 ${t.idx}`}
                </span>
                <p>{t.follow_up_prompt ?? q.prompt}</p>
              </div>
              {v ? (
                // 모르겠어요의 점 색(--dot-off)은 글자로 읽기 어려워 글자는 보조색으로 둔다
                <span
                  className={s.rowVerdict}
                  style={t.verdict === "unknown" ? undefined : { color }}
                >
                  {v.label}
                </span>
              ) : t.status === "graded" ? (
                <span className={`mono ${s.rowScore}`} style={{ color }}>
                  {t.score}
                </span>
              ) : (
                <span className={s.rowVerdict}>건너뜀</span>
              )}
            </li>
          );
        })}
      </ol>

      {review && (
        <section className={s.tiles}>
          <div className={`glass ${s.tile}`}>
            <span>다음 복습</span>
            <strong>{review.box ? `${days}일 뒤` : "익힌 질문이에요"}</strong>
          </div>
        </section>
      )}

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
