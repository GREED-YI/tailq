import { createAdminClient } from "@/lib/supabase/admin";
import { kstDay, pickDailyQuestion, type Pick } from "@/lib/daily-pick";

export type DailySession = {
  id: string;
  day: string;
  pick: Pick;
  status: string;
  question: { id: number; prompt: string; topicId: string; level: string };
};

const SESSION_COLUMNS =
  "id, day, pick, status, questions(id, prompt, topic_id, level)";

// 오늘의 질문 세션을 돌려준다. 오늘 세션이 있으면 그것을, 없으면 규칙대로 골라 만든다.
// 낼 질문이 하나도 없으면 null. userId는 호출한 쪽이 로그인으로 확인한 값이어야 한다.
export async function startDailySession(
  userId: string,
): Promise<DailySession | null> {
  const db = createAdminClient();
  const today = kstDay(new Date());

  const existing = await db
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .eq("kind", "daily")
    .eq("day", today)
    .maybeSingle()
    .throwOnError();
  if (existing.data) return toDailySession(existing.data);

  const [profile, reviews, sessions] = await Promise.all([
    db
      .from("profiles")
      .select("topics, levels")
      .eq("id", userId)
      .single()
      .throwOnError(),
    db
      .from("reviews")
      .select("question_id, due_day, questions!inner(is_hidden)")
      .eq("user_id", userId)
      .not("box", "is", null)
      .eq("questions.is_hidden", false)
      .throwOnError(),
    // ponytail: 지난 세션을 전부 읽는다(사용자당 하루 1개라 1년에 366개). 느려지면 최근 기간만 읽는다
    db
      .from("sessions")
      .select("question_id, day, questions(topic_id), turns(answered_at)")
      .eq("user_id", userId)
      .eq("turns.idx", 0)
      .throwOnError(),
  ]);
  const { topics, levels } = profile.data;
  const bank = topics.length
    ? (
        await db
          .from("bank_questions")
          .select("id, topic_id, level")
          .in("topic_id", topics)
          .throwOnError()
      ).data
    : [];

  const result = pickDailyQuestion({
    today,
    topics,
    levels,
    bank: bank.map((q) => ({
      id: q.id!,
      topicId: q.topic_id!,
      level: q.level!,
    })),
    reviews: reviews.data.map((r) => ({
      questionId: r.question_id,
      dueDay: r.due_day,
    })),
    sessions: sessions.data.map((s) => ({
      questionId: s.question_id,
      topicId: s.questions?.topic_id ?? null,
      day: s.day,
      answered: s.turns.some((t) => t.answered_at !== null),
    })),
  });
  if (result.pick === null) return null;

  // 같은 사용자의 요청이 동시에 와도 함수가 하나만 만들고, 늦은 쪽에는 먼저 만든 세션을 돌려준다
  const started = await db
    .rpc("start_daily_session", {
      p_user_id: userId,
      p_question_id: result.questionId,
      p_pick: result.pick,
    })
    .throwOnError();
  const created = await db
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("id", started.data.id)
    .single()
    .throwOnError();
  return toDailySession(created.data);
}

function toDailySession(row: {
  id: string;
  day: string;
  pick: string | null;
  status: string;
  questions: { id: number; prompt: string; topic_id: string; level: string };
}): DailySession {
  return {
    id: row.id,
    day: row.day,
    pick: row.pick as Pick,
    status: row.status,
    question: {
      id: row.questions.id,
      prompt: row.questions.prompt,
      topicId: row.questions.topic_id,
      level: row.questions.level,
    },
  };
}
