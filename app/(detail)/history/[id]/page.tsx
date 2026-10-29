import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { z } from "zod";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Icon } from "@/components/icons";
import { LEVELS } from "@/lib/profile";
import { tagLine } from "@/lib/questions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { turnResult, type TurnResult } from "@/lib/server/turn";
import { ScoreRing } from "@/app/interview/ScoreRing";
import { VerdictMark } from "@/app/interview/VerdictMark";
import { scoreVerdict, VERDICTS } from "@/app/interview/verdict";
import i from "@/app/interview/interview.module.css";
import s from "@/components/Marks.module.css";

export const metadata: Metadata = { title: "기록 상세 · TailQ" };

// 기록 상세(04 기능 명세 E-1, S20). 내 답변, 채점, 꼬리질문을 다시 본다.
export default function HistoryDetailPage({
  params,
}: PageProps<"/history/[id]">) {
  return (
    <div className={s.detail}>
      <Suspense fallback={<Header />}>
        {params.then(({ id }) => (
          <Detail id={id} />
        ))}
      </Suspense>
    </div>
  );
}

// 모바일은 뒤로 · 가운데 제목 · 북마크, PC는 뒤로 + 큰 제목(Figma S20).
// 뒤로는 이 기록의 질문 상세(W3). 질문을 읽기 전(불러오는 중)에는 Q노트로
function Header({
  backHref = "/questions",
  children,
}: {
  backHref?: string;
  children?: ReactNode;
}) {
  return (
    <header className={s.detailHeader}>
      <Link href={backHref} className="press icon-btn" aria-label="질문 상세로">
        <Icon name="chevronLeft" />
      </Link>
      <h1>기록 상세</h1>
      {children}
    </header>
  );
}

async function Detail({ id }: { id: string }) {
  if (!z.uuid().safeParse(id).success) notFound();
  // RLS가 자기 세션만 돌려준다. 목록과 같이 본 질문을 채점받은 끝난 세션만 연다
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select(
      "day, status, questions(id, prompt, topic_id, level, topics(field), projects(name), study_notes(title), bookmarks(question_id)), turns(id, idx, status, answer, follow_up_prompt)",
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
      <Header backHref={`/questions/${q.id}`}>
        {/* RLS가 내 북마크만 붙여 준다 */}
        <BookmarkButton questionId={q.id} initial={q.bookmarks.length > 0} />
      </Header>

      <div className={s.question}>
        {/* 난이도가 한글이라 본문 글꼴 + 고정폭 숫자(globals.css .mono 주석) */}
        <span className={`num ${s.tag}`}>
          {tagLine(q)}
          {/* 날짜는 결과 화면 머리와 같은 숫자형(DESIGN.md ko 날짜) */}
          {level && ` · ${level}`} · {session.day.replaceAll("-", ".")}
        </span>
        <h2>{q.prompt}</h2>
      </div>

      <MainResult answer={main.answer} result={results.get(main.id)!} />

      {session.turns.length > 1 && (
        <section className={s.block} aria-labelledby="follow-ups">
          <div className={s.listHead}>
            <h2 id="follow-ups">꼬리질문</h2>
          </div>
          <ol className={s.thread}>
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

// 본 질문: 내 답변 · 채점 결과 묶음(점수 · 막대 · 한 줄 평 · 놓친 개념 · 잘한 점과 보완할 점) · 접힌 모범 답안과 참고 자료(S20).
// 구획은 상자 없이 여백과 1px 선으로 나누고, surface 면은 채점 결과 묶음에만 깐다(DESIGN.md)
function MainResult({
  answer,
  result,
}: {
  answer: string | null;
  result: TurnResult;
}) {
  const unknown = result.verdict === "unknown";
  // 모르겠어요는 0점으로 기록되지만 점수 대신 –와 빈 막대로 보여준다
  const score = unknown ? undefined : (result.score ?? 0);
  const good = result.feedback?.good ?? [];
  const improve = result.feedback?.improve ?? [];
  return (
    <>
      <section className={s.block} aria-labelledby="my-answer">
        <h3 id="my-answer" className={s.label}>
          내 답변
        </h3>
        <p className={s.text}>{unknown ? "모르겠어요" : answer}</p>
      </section>

      <section className={s.result} aria-label="채점 결과">
        {/* 숫자 줄 오른쪽에 점수 구간 판정(모양 점 + 글자), 모르겠어요면 모르겠어요 */}
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
        {!unknown && result.feedback?.summary && (
          <p className={s.summary}>{result.feedback.summary}</p>
        )}
        {result.missingKeywords.length > 0 && (
          <div className={s.concepts}>
            <h3 className={s.label}>보완할 개념</h3>
            <div>
              {result.missingKeywords.map((k) => (
                <span key={k} className="tag tag-concept">
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
        {(good.length > 0 || improve.length > 0) && (
          <div className={s.points}>
            {good.length > 0 && (
              <div>
                <h3>잘한 점</h3>
                <ul>
                  {good.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            {improve.length > 0 && (
              <div>
                <h3>보완할 점</h3>
                <ul>
                  {improve.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={s.folds} aria-label="모범 답안과 참고 자료">
        <details>
          <summary>
            모범 답안
            <Icon name="chevronDown" size={18} />
          </summary>
          <p className={s.text}>{result.modelAnswer}</p>
        </details>
        {result.links.length > 0 && (
          <details>
            <summary>
              참고 자료
              <Icon name="chevronDown" size={18} />
            </summary>
            <ul className={s.links}>
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
    </>
  );
}

// 꼬리질문 한 단계(thread result): 단계 이름 · 판정(모양 점 + 글자) · 질문. 누르면 내 답변과 AI 코멘트를 펼친다.
// 펼침 표시로 "답변 보기 ⌄"(펼치면 "접기")를 붙인다(#117). 순서는 내 답변(모르겠어요면 생략) → AI 코멘트 → 기대 답안.
// 기대 답안은 처음엔 모르겠어요일 때만 보여줬는데, 다시 보는 화면이라 판정과 상관없이 늘 보여준다(W3)
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
  const unknown = result?.verdict === "unknown";
  // 판정이 없으면(날짜를 넘겨 닫힘) 모르겠어요와 같은 빈 원
  const mark = VERDICTS[result?.verdict ?? "unknown"] ?? VERDICTS.unknown;
  const dot = (
    <span
      className={`${i.threadDot} ${s.stepDot}`}
      data-shape={mark.shape}
      style={{ color: mark.color }}
      aria-hidden="true"
    />
  );
  const head = (
    <>
      <span className={s.stepHead}>
        <span className={`num ${s.stepName}`}>꼬리질문 {idx}</span>
        {/* 판정이 없으면(날짜를 넘겨 닫힘) 건너뜀 */}
        {result ? (
          <VerdictMark
            verdict={result.verdict ?? "unknown"}
            className={s.stepVerdict}
          />
        ) : (
          <VerdictMark verdict="unknown" className={s.stepVerdict}>
            건너뜀
          </VerdictMark>
        )}
      </span>
      <span className={s.stepPrompt}>{prompt}</span>
    </>
  );
  // 판정이 없으면(날짜를 넘겨 닫힘) 펼칠 내용이 없다
  if (!result)
    return (
      <li className={s.step}>
        {dot}
        <div className={s.stepStatic}>{head}</div>
      </li>
    );
  return (
    <li className={s.step}>
      {dot}
      <details>
        <summary>
          {head}
          <span className={s.stepMore} aria-hidden="true">
            <span className={s.stepMoreOpen}>답변 보기</span>
            <span className={s.stepMoreClose}>접기</span>
            <Icon name="chevronDown" size={16} />
          </span>
        </summary>
        <div className={s.stepBody}>
          {!unknown && <p className={s.text}>{answer}</p>}
          {result.feedback?.summary && (
            <div className={s.comment}>
              <span className={s.aiLabel}>AI 코멘트</span>
              <p>{result.feedback.summary}</p>
            </div>
          )}
          {result.modelAnswer && (
            <div>
              <span className={s.label}>기대 답안</span>
              <p className={s.text}>{result.modelAnswer}</p>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}
