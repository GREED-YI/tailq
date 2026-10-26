import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/icons";
import { LEVELS } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { turnResult, type TurnResult } from "@/lib/turn";
import i from "@/app/interview/interview.module.css";
import { ScoreRing } from "@/app/interview/ScoreRing";
import { VERDICTS } from "@/app/interview/verdict";
import s from "../history.module.css";

export const metadata: Metadata = { title: "기록 상세 · TailQ" };

// 기록 상세(04 기능 명세 E-1, S20). 내 답변, 채점, 꼬리질문을 다시 본다.
export default function HistoryDetailPage({
  params,
}: PageProps<"/history/[id]">) {
  return (
    <div className={s.detail}>
      <AppHeader />
      <div className={s.back}>
        <Link
          href="/history"
          className="glass press icon-btn"
          aria-label="기록으로"
        >
          <Icon name="arrowLeft" />
        </Link>
        <h1>기록 상세</h1>
      </div>
      <Suspense>
        {params.then(({ id }) => (
          <Detail id={id} />
        ))}
      </Suspense>
    </div>
  );
}

const weekday = (day: string) =>
  new Date(`${day}T00:00:00Z`)
    .toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
    .toUpperCase();

async function Detail({ id }: { id: string }) {
  if (!z.uuid().safeParse(id).success) notFound();
  // RLS가 자기 세션만 돌려준다. 목록과 같이 본 질문을 채점받은 끝난 세션만 연다
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select(
      "day, status, questions(id, prompt, topic_id, level, topics(field)), turns(id, idx, status, answer, follow_up_prompt)",
    )
    .eq("id", id)
    .order("idx", { referencedTable: "turns" })
    .maybeSingle()
    .throwOnError();
  const main = session?.turns[0];
  if (session?.status !== "done" || main?.idx !== 0 || main.status !== "graded")
    notFound();

  // 모범 답안·기대 답안은 서버 전용이다. 위에서 내 세션의 채점이 끝난 턴임을 확인했으므로 꺼낸다
  // (08 설계 "모범 답안과 기대 답안 보호")
  const admin = createAdminClient();
  const results = new Map(
    (
      await Promise.all(
        session.turns
          .filter((t) => t.status === "graded")
          .map((t) => turnResult(admin, t.id)),
      )
    ).map((r) => [r.turnId, r]),
  );
  const q = session.questions;
  const level = LEVELS.find((l) => l.id === q.level)?.label;

  return (
    <>
      <div className={s.question}>
        {/* 난이도가 한글이라 본문 글꼴 + 고정폭 숫자(globals.css .mono 주석) */}
        <span className={`num ${s.tag}`}>
          Q.{String(q.id).padStart(3, "0")} · {q.topics.field} / {q.topic_id}
          {level && ` · ${level}`} · {session.day.replaceAll("-", ".")}{" "}
          {weekday(session.day)}
        </span>
        <h2 className={s.panelTitle}>{q.prompt}</h2>
      </div>

      <MainResult answer={main.answer} result={results.get(main.id)!} />

      {session.turns.length > 1 && (
        <section className={`glass ${s.card}`} aria-label="꼬리질문">
          <span className={i.label}>꼬리질문</span>
          <ol className={s.followUps}>
            {session.turns.slice(1).map((t) => (
              <FollowUp
                key={t.id}
                idx={t.idx}
                prompt={t.follow_up_prompt ?? ""}
                answer={t.answer}
                result={results.get(t.id)}
              />
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

// 본 질문: 면접 화면의 채점 결과와 같은 내용. 모범 답안·참고 자료는 접어 둔다(S20)
function MainResult({
  answer,
  result,
}: {
  answer: string | null;
  result: TurnResult;
}) {
  const unknown = result.verdict === "unknown";
  return (
    <section className={`glass ${s.card}`} aria-label="본 질문">
      <div className={i.block}>
        <span className={i.label}>내 답변</span>
        <p className={s.answer}>{unknown ? "모르겠어요" : answer}</p>
      </div>

      <div className={i.top}>
        <ScoreRing
          shown={result.score ?? 0}
          value={result.score ?? 0}
          label={`100점 만점에 ${result.score ?? 0}점`}
        />
        <div className={i.headline}>
          <strong>{unknown ? "모르겠어요" : result.feedback?.summary}</strong>
          {result.feedback?.good.map((g) => (
            <span key={g}>{g}</span>
          ))}
        </div>
      </div>

      {!!result.feedback?.improve.length && (
        <div className={i.block}>
          <span className={i.label}>보완할 점</span>
          <ul className={i.list}>
            {result.feedback.improve.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {result.missingKeywords.length > 0 && (
        <div className={i.chips}>
          <span className={i.label}>보완할 개념</span>
          {result.missingKeywords.map((k) => (
            <span
              key={k}
              className={`glass ${i.chip} ${/[가-힣]/.test(k) ? "" : "mono"}`}
            >
              {k}
            </span>
          ))}
        </div>
      )}

      <details className={s.fold}>
        <summary>모범 답안</summary>
        <p className={i.well}>{result.modelAnswer}</p>
      </details>

      {result.links.length > 0 && (
        <details className={s.fold}>
          <summary>참고 자료</summary>
          <ul className={i.links}>
            {result.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

// 꼬리질문: 판정과 한 줄 피드백. 기대 답안은 면접 화면과 같이 모르겠어요일 때만 보여준다
function FollowUp({
  idx,
  prompt,
  answer,
  result,
}: {
  idx: number;
  prompt: string;
  answer: string | null;
  result: TurnResult | undefined;
}) {
  const verdict =
    result && (VERDICTS[result.verdict ?? ""] ?? VERDICTS.unknown);
  const unknown = result?.verdict === "unknown";
  return (
    <li className={s.followUp}>
      <div className={s.followUpHead}>
        <span className="mono">{String(idx).padStart(2, "0")}</span>
        <span>{prompt}</span>
      </div>
      {verdict ? (
        <>
          {!unknown && (
            <div className={i.block}>
              <span className={i.label}>내 답변</span>
              <p className={s.answer}>{answer}</p>
            </div>
          )}
          <div className={i.verdict}>
            <span
              className={i.verdictDot}
              style={{ background: verdict.color }}
              aria-hidden="true"
            />
            <strong>{verdict.label}</strong>
          </div>
          {result.feedback?.summary && (
            <p className={i.feedbackLine}>{result.feedback.summary}</p>
          )}
          {unknown && (
            <div className={i.block}>
              <span className={i.label}>기대 답안</span>
              <p className={i.well}>{result.modelAnswer}</p>
            </div>
          )}
        </>
      ) : (
        <p className={i.feedbackLine}>건너뜀</p>
      )}
    </li>
  );
}
