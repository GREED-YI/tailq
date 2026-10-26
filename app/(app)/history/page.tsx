import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { HistoryList } from "./HistoryList";
import { HistoryTabs } from "./HistoryTabs";
import s from "./history.module.css";

export const metadata: Metadata = { title: "기록 · TailQ" };

// 학습 기록 목록(04 기능 명세 E-1, S19). 끝난 세션을 날짜 역순으로 본다.
// 북마크만 보기(E-4)·월 선택은 각 이슈에서 붙인다.
export default function HistoryPage() {
  return (
    <>
      <AppHeader />
      <h1 className={s.title}>기록</h1>
      <HistoryTabs current="list" />
      <Suspense>
        <Sessions />
      </Suspense>
    </>
  );
}

// RLS가 자기 세션과 그 질문·턴만 보여준다. 본 질문을 채점받은(답했거나 모르겠어요) 끝난 세션만 기록이다.
// 답하지 않고 날짜가 지난 세션(expired)은 다시 볼 내용이 없어 뺀다.
// 전부 읽는다(하루 1세션이라 1년에 366개쯤). 길어지면 월 선택으로 나눠 읽는다
async function Sessions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select(
      "id, day, questions(id, prompt, topic_id, topics(field)), turns(idx, status, score, verdict, follow_up_prompt)",
    )
    .eq("status", "done")
    .order("day", { ascending: false })
    .order("created_at", { ascending: false })
    .order("idx", { referencedTable: "turns" })
    .throwOnError();

  const items = data
    .filter((r) => r.turns[0]?.idx === 0 && r.turns[0].status === "graded")
    .map((r) => ({
      id: r.id,
      day: r.day,
      qid: r.questions.id,
      prompt: r.questions.prompt,
      tag: `${r.questions.topics.field} / ${r.questions.topic_id}`,
      turns: r.turns,
    }));
  return <HistoryList items={items} />;
}
