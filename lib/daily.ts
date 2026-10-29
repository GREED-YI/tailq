import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { kstDay, pickDailyQuestion, type Pick } from "@/lib/daily-pick";
import { questionTags } from "@/lib/questions";
import { track } from "@/lib/server/track";
import { budgetUsd } from "@/lib/server/usage";

// 면접·결과 화면이 보여주는 질문. 프로젝트 질문이면 projectId, 학습 자료 질문이면 noteId가 있다
export type SessionQuestion = {
  id: number;
  prompt: string;
  label: string;
  topic: string;
  projectId: string | null;
  noteId: string | null;
};

// 연습 세션(?session=)을 마치거나 나갈 때 돌아갈 질문 목록(프로젝트 또는 학습 자료)
export const sourceHref = (q: SessionQuestion) =>
  q.noteId ? `/projects/notes/${q.noteId}` : `/projects/${q.projectId}`;

export type DailySession = {
  id: string;
  day: string;
  pick: Pick;
  status: string;
  question: SessionQuestion;
};

export const QUESTION_COLUMNS =
  "id, prompt, topic_id, project_id, note_id, topics(field), projects(name), study_notes(title)";
const SESSION_COLUMNS =
  `id, day, pick, status, questions(${QUESTION_COLUMNS})` as const;

// 오늘의 질문 세션을 돌려준다. 오늘 세션이 있으면 그것을, 없으면 규칙대로 골라 만든다.
// 낼 질문이 하나도 없으면 null, 서비스 월 예산에 닿아 새로 시작할 수 없으면 "budget"(이미 있는 오늘 세션은 그대로 준다).
// userId는 호출한 쪽이 로그인으로 확인한 값이어야 한다.
export async function startDailySession(
  userId: string,
): Promise<DailySession | null | "budget"> {
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
  const started = await db.rpc("start_daily_session", {
    p_user_id: userId,
    p_question_id: result.questionId,
    p_pick: result.pick,
    p_budget_usd: budgetUsd(),
  });
  if (started.error?.message === "BUDGET_EXCEEDED") return "budget";
  if (started.error) throw started.error;
  await track(
    "session_start",
    { session_id: started.data.id, kind: "daily" },
    userId,
  );
  const created = await db
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("id", started.data.id)
    .single()
    .throwOnError();
  return toDailySession(created.data);
}

// 내 프로젝트·학습 자료 질문 세션(면접 화면의 ?session=, 둘 다 kind = project). 내 세션이 아니거나 연습 세션이 아니면 null
export async function loadProjectSession(userId: string, sessionId: string) {
  if (!z.uuid().safeParse(sessionId).success) return null;
  const { data } = await createAdminClient()
    .from("sessions")
    .select(`id, status, questions(${QUESTION_COLUMNS})`)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("kind", "project")
    .maybeSingle()
    .throwOnError();
  return (
    data && {
      id: data.id,
      status: data.status,
      question: toSessionQuestion(data.questions),
    }
  );
}

type QuestionRow = {
  id: number;
  prompt: string;
  topic_id: string | null;
  project_id: string | null;
  note_id: string | null;
  topics: { field: string } | null;
  projects: { name: string } | null;
  study_notes: { title: string } | null;
};

export function toSessionQuestion(q: QuestionRow): SessionQuestion {
  return {
    id: q.id,
    prompt: q.prompt,
    ...questionTags(q),
    projectId: q.project_id,
    noteId: q.note_id,
  };
}

function toDailySession(row: {
  id: string;
  day: string;
  pick: string | null;
  status: string;
  questions: QuestionRow;
}): DailySession {
  return {
    id: row.id,
    day: row.day,
    pick: row.pick as Pick,
    status: row.status,
    question: toSessionQuestion(row.questions),
  };
}
