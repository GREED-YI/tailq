import { kstDay } from "@/lib/daily-pick";
import { computeStreak, grassStart, studyDay, type Streak } from "@/lib/streak";
import { createClient } from "@/lib/supabase/server";

export type Study = {
  today: string;
  // 학습한 날 → 그날 본 질문 점수(채점 전·실패면 null)
  scores: Map<string, number | null>;
  streak: Streak;
};

// 최근 1년(잔디 52주)의 학습한 날을 사용자 권한으로 읽어 꼬리잇기를 계산한다.
// 오늘의 질문 세션(daily, 이어받은 체험 포함)만 친다. 프로젝트 질문 세션은 넣지 않는다(08 설계)
// ponytail: 1년보다 긴 꼬리잇기는 1년에서 잘린다. 필요해지면 끊긴 날까지 더 거슬러 읽는다
export async function loadStudy(): Promise<Study> {
  const supabase = await createClient();
  const today = kstDay(new Date());
  // 학습한 날은 제출 시각의 한국 날짜라 세션 날짜가 아니라 제출 시각으로 거른다
  const { data } = await supabase
    .from("sessions")
    .select("turns!inner(answered_at, score)")
    .eq("kind", "daily")
    .eq("turns.idx", 0)
    .not("turns.answered_at", "is", null)
    .gte("turns.answered_at", `${grassStart(today)}T00:00:00+09:00`)
    .throwOnError();

  const scores = new Map<string, number | null>();
  for (const { turns } of data) {
    for (const t of turns) {
      const day = studyDay(t.answered_at!);
      const prev = scores.get(day) ?? null;
      scores.set(
        day,
        t.score == null ? prev : Math.max(t.score, prev ?? t.score),
      );
    }
  }
  return { today, scores, streak: computeStreak([...scores.keys()], today) };
}
