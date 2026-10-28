import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/icons";
import { kstDay } from "@/lib/daily-pick";
import { ATTEMPT_COLUMNS, tagLine } from "@/lib/questions";
import {
  daysUntil,
  dueLabel,
  inQuestionFilter,
  questionFilter,
  type QuestionFilter,
  type QuestionItem,
} from "@/lib/review";
import { createClient } from "@/lib/supabase/server";
import { Dots, Score } from "../history/marks";
import h from "../history/history.module.css";
import { QuestionFilters } from "./QuestionFilters";
import s from "./questions.module.css";

export const metadata: Metadata = { title: "내 질문 · TailQ" };

// 내 질문(W2). 복습 목록과 기록 목록을 질문 하나에 한 줄로 합쳤다. 날짜별 시도는 질문 상세(/questions/[id])의 기록에서 본다.
// 옛 /review·/history 화면은 #132까지 그대로 열린다
export default function QuestionsPage({
  searchParams,
}: PageProps<"/questions">) {
  return (
    <div className={s.page}>
      <AppHeader title="내 질문" />
      <h1 className={s.pageTitle}>내 질문</h1>
      <Suspense fallback={<Loading />}>
        {searchParams.then((p) => (
          <Questions filter={p.filter} />
        ))}
      </Suspense>
    </div>
  );
}

const DESC = "잘 답하면 복습 간격이 늘어나고, 부족하면 처음부터 다시 나와요";

// 불러오는 동안: 같은 높이의 행 자리 4개
function Loading() {
  return (
    <div aria-busy="true">
      <p className={`num ${s.count}`}>질문</p>
      <p className={s.desc}>{DESC}</p>
      <ul className={`${h.list} ${s.rows}`}>
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className={s.skeleton} />
        ))}
      </ul>
    </div>
  );
}

const EMPTY: Record<QuestionFilter, string> = {
  today: "오늘 복습할 질문이 없어요",
  week: "이번 주 복습할 질문이 없어요",
  bookmark: "면접 화면이나 기록 상세에서 별표를 누르면 여기에 질문이 모여요",
  mastered: "아직 복습 완료한 질문이 없어요",
  all: "오늘의 질문을 마치면 여기에 질문이 쌓여요",
};

type Item = QuestionItem & {
  id: number;
  prompt: string;
  meta: string;
  count: number;
  score: number | null;
};

// 본 질문을 채점받은 세션을 최근 순으로 한 번에 읽어 질문마다 묶는다(RLS가 내 것만 준다).
// ponytail: 기록 화면처럼 전부 읽는다(하루 1세션이라 1년에 366행쯤). 몇 년 치가 쌓이면 나눠 읽는다
async function Questions({ filter: raw }: { filter: unknown }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select(ATTEMPT_COLUMNS)
    .eq("turns.idx", 0)
    .eq("turns.status", "graded")
    .order("day", { ascending: false })
    .order("created_at", { ascending: false })
    .throwOnError();

  // 처음 만나는 세션이 그 질문의 가장 최근 시도다(Map은 넣은 순서를 지킨다)
  const byQuestion = new Map<number, Item>();
  for (const r of data) {
    const seen = byQuestion.get(r.question_id);
    if (seen) {
      seen.count++;
      continue;
    }
    const q = r.questions;
    const main = r.turns[0];
    // 숨긴 질문은 다시 나오지 않으므로 복습 정보를 비운다(옛 복습 화면과 같은 기준)
    const review = q.is_hidden ? undefined : q.reviews[0];
    byQuestion.set(r.question_id, {
      id: q.id,
      prompt: q.prompt,
      meta: q.projects ? q.projects.name : tagLine(q),
      count: 1,
      score: main.verdict === "unknown" ? null : main.score,
      box: review?.box ?? null,
      dueDay: review?.due_day ?? null,
      bookmarked: q.bookmarks.length > 0,
    });
  }
  const items = [...byQuestion.values()];
  const today = kstDay(new Date());
  const filter = questionFilter(raw, items, today);
  const counts = Object.fromEntries(
    (["today", "week", "bookmark", "mastered", "all"] as const).map((f) => [
      f,
      items.filter((r) => inQuestionFilter(r, f, today)).length,
    ]),
  ) as Record<QuestionFilter, number>;

  const shown = items.filter((r) => inQuestionFilter(r, filter, today));
  // 복습 필터는 복습일 순(같으면 질문 번호), 나머지는 최근에 푼 순(읽은 순서 그대로)
  if (filter === "today" || filter === "week")
    shown.sort((a, b) => a.dueDay!.localeCompare(b.dueDay!) || a.id - b.id);

  return (
    <>
      <p className={`num ${s.count}`}>
        질문 {items.length}개
        {counts.today > 0 && ` · 오늘 복습 ${counts.today}개`}
      </p>
      <p className={s.desc}>{DESC}</p>
      <QuestionFilters current={filter} counts={counts} />

      <ul className={`${h.list} ${s.rows}`}>
        {shown.length === 0 && (
          <li className={`${h.rowEmpty} ${s.empty}`}>
            {EMPTY[filter]}
            {filter === "today" && (
              <Link href="?filter=week" className="btn btn-ghost press">
                이번 주 보기
              </Link>
            )}
          </li>
        )}
        {shown.map((r) => (
          <li key={r.id}>
            <Link
              href={`/questions/${r.id}`}
              className={`${h.rowLink} ${s.row}`}
            >
              <Row r={r} today={today} />
            </Link>
          </li>
        ))}
      </ul>

      <div className={s.note}>
        <strong>숙련도</strong>
        <p>
          잘 답할수록 다음 복습까지 간격이 길어져요.
          <br />
          숙련도 5칸을 다 채우면 &lsquo;복습 완료&rsquo;로 옮겨져요.
        </p>
      </div>
    </>
  );
}

// 질문 1개 = 1행(list-row question): 복습 시기 라벨 · 질문과 메타 · 최근 점수 · 숙련도.
// 오늘 다시(밀린 것 포함)만 accent 라벨. 숨긴 질문은 복습 정보가 없어 라벨 자리를 비우고 숙련도도 비운다
function Row({ r, today }: { r: Item; today: string }) {
  const days = r.dueDay === null ? null : daysUntil(r.dueDay, today);
  return (
    <>
      <span className={s.due}>
        {days !== null && (
          <span
            className={`num tag ${r.box !== null && days <= 0 ? "tag-today" : "tag-neutral"} ${h.due}`}
          >
            {r.box === null ? "복습 완료" : dueLabel(days)}
          </span>
        )}
      </span>
      <span className={s.body}>
        <span className={s.prompt}>{r.prompt}</span>
        <span className={`num ${s.meta}`}>
          {r.meta} · {r.count}번 풀었어요
          {r.bookmarked && (
            <span className={s.star} role="img" aria-label="북마크함">
              <Icon name="star" size={14} bold />
            </span>
          )}
        </span>
      </span>
      <span
        className={s.score}
        {...(r.score === null && { role: "img", "aria-label": "점수 없음" })}
      >
        <Score value={r.score} />
      </span>
      <span className={s.level}>
        <Dots level={r.dueDay === null ? 0 : (r.box ?? 5)} />
      </span>
    </>
  );
}
