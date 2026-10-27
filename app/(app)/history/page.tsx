import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { qLabel } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import { HistoryFilters } from "./HistoryFilters";
import { HistoryList } from "./HistoryList";
import s from "./history.module.css";

export const metadata: Metadata = { title: "기록 · TailQ" };

// 학습 기록 목록(04 기능 명세 E-1, S19). 끝난 세션을 날짜 역순으로, 달마다 나눠 한 피드로 본다.
// ?filter=bookmark면 북마크한 질문의 세션만(E-4).
// 처음엔 ?month로 한 달씩 보여줬으나 목록이 달 끝에서 끊겨 보여, 모든 달을 이어 붙이고 달 칩은 그 달로 건너뛰게 바꿨다(#117)
export default function HistoryPage({ searchParams }: PageProps<"/history">) {
  return (
    <div className={s.page}>
      <Suspense fallback={<Top />}>
        {searchParams.then((p) => (
          <Sessions bookmarkOnly={p.filter === "bookmark"} />
        ))}
      </Suspense>
    </div>
  );
}

// 제목과 필터는 위에 붙어 있고, 목록은 그 아래로 지나간다(유리 띠가 가린다)
function Top({
  bookmarkOnly = false,
  months = [],
}: {
  bookmarkOnly?: boolean;
  months?: string[];
}) {
  return (
    <div className={s.top}>
      <AppHeader title="기록" />
      <h1 className={s.pageTitle}>기록</h1>
      <HistoryFilters bookmarkOnly={bookmarkOnly} months={months} />
    </div>
  );
}

// RLS가 자기 세션과 그 질문·턴만 보여준다. 본 질문을 채점받은(답했거나 모르겠어요) 끝난 세션만 기록이다.
// 답하지 않고 날짜가 지난 세션(expired)은 다시 볼 내용이 없어 뺀다.
// 전부 읽어 한 번에 그린다(하루 1세션이라 1년에 366개쯤)
// ponytail: 몇 년 치가 쌓여 목록이 무거워지면 달 단위로 나눠 끝에 닿을 때 이어 읽는다
async function Sessions({ bookmarkOnly }: { bookmarkOnly: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select(
      "id, day, questions(id, prompt, project_id, bookmarks(question_id)), turns(idx, status, score, verdict)",
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
      label: qLabel(r.questions),
      prompt: r.questions.prompt,
      // RLS가 내 북마크만 붙여 준다
      bookmarked: r.questions.bookmarks.length > 0,
      turns: r.turns,
    }))
    .filter((r) => !bookmarkOnly || r.bookmarked);
  // 날짜 역순이라 첫 달이 가장 최근 달
  const months = [...new Set(items.map((r) => r.day.slice(0, 7)))];

  return (
    <>
      <Top bookmarkOnly={bookmarkOnly} months={months} />
      {months.length === 0 ? (
        <p className={`glass ${s.empty}`}>
          {bookmarkOnly
            ? "면접 화면이나 기록 상세에서 별표를 누르면 여기에 모여요"
            : "오늘의 질문을 마치면 여기에 기록이 남아요"}
        </p>
      ) : (
        months.map((m) => (
          <HistoryList
            key={m}
            month={m}
            items={items.filter((r) => r.day.startsWith(m))}
          />
        ))
      )}
    </>
  );
}
