import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Icon } from "@/components/icons";
import { kstDay } from "@/lib/daily-pick";
import { LEVELS } from "@/lib/profile";
import { ATTEMPT_COLUMNS, tagLine } from "@/lib/questions";
import { daysUntil, dueLabel } from "@/lib/review";
import { createClient } from "@/lib/supabase/server";
import { Dots, Score } from "@/app/(app)/history/marks";
import h from "@/app/(app)/history/history.module.css";
import s from "@/app/(app)/questions/questions.module.css";

export const metadata: Metadata = { title: "질문 · TailQ" };

// 질문 상세(W12). 질문 하나의 복습 상태와 날짜별 기록을 본다. 기록을 누르면 기록(시도) 상세 /history/[id]
export default function QuestionDetailPage({
  params,
}: PageProps<"/questions/[id]">) {
  return (
    <div className={h.detail}>
      <Suspense fallback={<Loading />}>
        {params.then(({ id }) => (
          <Detail id={id} />
        ))}
      </Suspense>
    </div>
  );
}

// 모바일은 뒤로 · 가운데 제목 · 북마크, PC는 뒤로 + 큰 제목(기록 상세와 같은 머리)
function Header({ children }: { children?: ReactNode }) {
  return (
    <header className={h.detailHeader}>
      <Link
        href="/questions"
        className="press icon-btn"
        aria-label="내 질문 목록으로"
      >
        <Icon name="chevronLeft" />
      </Link>
      <h1>질문</h1>
      {children}
    </header>
  );
}

// 불러오는 동안: 머리 · 질문 자리 · 행 자리 2개
function Loading() {
  return (
    <div aria-busy="true">
      <Header />
      <div className={h.question}>
        <span className={s.skeleton} />
      </div>
      <ul className={`${h.list} ${s.history}`}>
        <li className={s.skeleton} />
        <li className={s.skeleton} />
      </ul>
    </div>
  );
}

// 요일 한 글자(DESIGN.md 날짜 "10월 30일(금)", 면접 결과 화면과 같다)
const weekday = (day: string) =>
  "일월화수목금토"[new Date(`${day}T00:00:00Z`).getUTCDay()];

async function Detail({ id }: { id: string }) {
  const questionId = Number(id);
  if (!Number.isSafeInteger(questionId) || questionId <= 0) notFound();
  // RLS가 내 세션만 준다. 본 질문을 채점받은 세션이 없으면 내 질문이 아니다(404)
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select(ATTEMPT_COLUMNS)
    .eq("question_id", questionId)
    .eq("turns.idx", 0)
    .eq("turns.status", "graded")
    .order("day", { ascending: false })
    .order("created_at", { ascending: false })
    .throwOnError();
  if (data.length === 0) notFound();

  const q = data[0].questions;
  const level = LEVELS.find((l) => l.id === q.level)?.label;
  // 숨긴 질문은 복습에서 빠지므로 상태 줄을 그리지 않는다(내 질문 목록과 같은 기준)
  const review = q.is_hidden ? undefined : q.reviews[0];
  const days = review ? daysUntil(review.due_day, kstDay(new Date())) : 0;
  // 기록 상세가 열리는 기준과 같이 끝난 세션만
  const attempts = data.filter((r) => r.status === "done");

  return (
    <>
      <Header>
        {/* RLS가 내 북마크만 붙여 준다 */}
        <BookmarkButton questionId={q.id} initial={q.bookmarks.length > 0} />
      </Header>

      <div className={h.question}>
        <span className={`num ${h.tag}`}>
          {tagLine(q)}
          {level && ` · ${level}`}
        </span>
        <h2>{q.prompt}</h2>
        <p className={`num ${s.status}`}>
          {review && (
            <>
              <span
                className={`tag ${review.box !== null && days <= 0 ? "tag-today" : "tag-neutral"}`}
              >
                {review.box === null ? "복습 완료" : dueLabel(days)}
              </span>
              <Dots level={review.box ?? 5} />
            </>
          )}
          <span>{data.length}번 풀었어요</span>
        </p>
      </div>

      {/* #130 셀프 복습 자리: 상태 줄 바로 아래. 지금은 그리지 않는다 */}

      <section className={s.history} aria-labelledby="attempts">
        {/* #131 지난 답·점수 변화 자리: 기록 목록 바로 위. 지금은 그리지 않는다 */}
        <div className={h.listHead}>
          <h2 id="attempts">기록</h2>
        </div>
        <ul className={h.list}>
          {attempts.length === 0 && (
            <li className={h.rowEmpty}>
              오늘의 질문을 마치면 여기에 기록이 남아요
            </li>
          )}
          {attempts.map((r) => {
            const main = r.turns[0];
            const score = main.verdict === "unknown" ? null : main.score;
            const [, m, d] = r.day.split("-").map(Number);
            return (
              <li key={r.id}>
                <Link
                  href={`/history/${r.id}`}
                  className={`${h.rowLink} ${s.attempt}`}
                  aria-label={`${m}월 ${d}일 기록, ${score === null ? "모르겠어요" : `${score}점`}`}
                >
                  <span className={`num ${s.attemptDate}`}>
                    {m}월 {d}일({weekday(r.day)})
                  </span>
                  <Score value={score} />
                  <Icon name="chevronRight" size={18} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <a className={s.report} href={`/my/feedback?category=report&q=${q.id}`}>
        질문이나 채점에 문제가 있나요?
      </a>
    </>
  );
}
