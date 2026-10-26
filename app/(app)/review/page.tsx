import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { kstDay } from "@/lib/daily-pick";
import { createClient } from "@/lib/supabase/server";
import { ReviewList } from "./ReviewList";
import s from "./review.module.css";

export const metadata: Metadata = { title: "복습 · TailQ" };

// 복습 목록(04 기능 명세 5번, S18). 복습 예정 질문과 다음 복습일, 익힌 질문을 본다.
export default function ReviewPage() {
  return (
    <div className={s.page}>
      <AppHeader />
      <h1 className={s.pageTitle}>복습</h1>
      <Suspense fallback={<Heading />}>
        <Reviews />
      </Suspense>
    </div>
  );
}

function Heading({ count }: { count?: number }) {
  return (
    <>
      <h2 className={`num ${s.title}`}>
        복습할 질문{count === undefined ? "" : ` ${count}개`}
      </h2>
      <p className={s.desc}>
        잘 답하면 간격이 늘어나고, 부족하면 처음부터 다시 나와요
      </p>
    </>
  );
}

// ponytail: PostgREST 기본 최대 1,000행. 복습 중인 질문이 1,000개를 넘으면(매일 풀어도 몇 년) .range()로 나눠 읽는다
// RLS가 자기 복습 행과 그 질문만 보여준다. 숨긴 질문은 다시 나오지 않으므로 뺀다(lib/daily.ts와 같은 기준)
async function Reviews() {
  const supabase = await createClient();
  const [{ data }, { data: sessions }] = await Promise.all([
    supabase
      .from("reviews")
      .select(
        "box, due_day, questions!inner(id, prompt, topic_id, topics(field))",
      )
      .eq("questions.is_hidden", false)
      .order("due_day")
      .order("question_id")
      .throwOnError(),
    // 행을 누르면 그 질문의 가장 최근 기록 상세로 간다. 기록 목록과 같이 본 질문을 채점받은 끝난 세션만
    supabase
      .from("sessions")
      .select("id, question_id, turns!inner(idx)")
      .eq("status", "done")
      .eq("turns.idx", 0)
      .eq("turns.status", "graded")
      .order("day", { ascending: false })
      .throwOnError(),
  ]);

  const latest = new Map<number, string>();
  for (const r of sessions) {
    if (!latest.has(r.question_id)) latest.set(r.question_id, r.id);
  }
  const items = data.map((r) => ({
    box: r.box,
    dueDay: r.due_day,
    id: r.questions.id,
    prompt: r.questions.prompt,
    tag: `${r.questions.topics.field} / ${r.questions.topic_id}`,
    sessionId: latest.get(r.questions.id),
  }));
  return (
    <>
      <Heading count={items.filter((r) => r.box !== null).length} />
      <ReviewList items={items} today={kstDay(new Date())} />
    </>
  );
}
