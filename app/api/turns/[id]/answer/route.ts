import { cookies } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { grade, gradeFollowUp, GradingError } from "@/lib/ai";
import {
  toFollowUpGrading,
  toGrading,
  type FollowUpInput,
  type Rubric,
} from "@/lib/grading";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/track";
import { TRIAL_COOKIE } from "@/lib/trial";
import {
  dbErrorResponse,
  errorResponse,
  turnResult,
  type TurnResult,
} from "@/lib/turn";

// 채점(최대 15초)과 결과 저장(after)까지 끊기지 않게(08 설계 "실행 환경")
export const maxDuration = 60;

const Body = z.union([
  z.object({ dontKnow: z.literal(true) }),
  z.object({ text: z.string() }),
]);

// 답변 저장 → 채점(SSE). { dontKnow: true }면 AI 없이 JSON으로 결과를 돌려준다(08 설계 4장).
// 실패한 턴에 같은 요청을 다시 보내면 다시 채점이다.
export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/turns/[id]/answer">,
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  // 로그인하지 않았으면 체험 쿠키의 토큰으로 소유를 확인한다(08 설계 "체험과 이어받기")
  const trialToken = userId
    ? undefined
    : (await cookies()).get(TRIAL_COOKIE)?.value;
  if (!userId && !trialToken) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요해요.");
  }

  const { id } = await ctx.params;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return errorResponse(400, "VALIDATION", "답변 형식이 맞지 않아요.");
  }
  const dontKnow = "dontKnow" in body.data;
  const text = "text" in body.data ? body.data.text.trim() : "";
  if (!dontKnow && (text.length < 30 || text.length > 2000)) {
    return errorResponse(
      400,
      "VALIDATION",
      "답변은 30자 이상 2,000자 이하로 써 주세요.",
    );
  }
  if (!z.uuid().safeParse(id).success) {
    return errorResponse(404, "NOT_FOUND", "질문을 찾을 수 없어요.");
  }

  const db = createAdminClient();
  const { data: turn } = await db
    .from("turns")
    .select(
      "idx, session_id, sessions(user_id, kind, trial_token, questions(prompt, level, topics(name, field), projects(name), question_keys(rubric, model_answer)))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!turn) return errorResponse(404, "NOT_FOUND", "질문을 찾을 수 없어요.");
  const owner = userId
    ? turn.sessions.user_id === userId
    : !turn.sessions.user_id && turn.sessions.trial_token === trialToken;
  if (!owner) {
    return errorResponse(403, "NOT_OWNER", "내 질문이 아니에요.");
  }

  try {
    await db
      .rpc("submit_answer", {
        p_turn_id: id,
        p_user_id: userId,
        p_trial_token: trialToken,
        p_answer: text,
        p_dont_know: dontKnow,
      })
      .throwOnError();
  } catch (e) {
    return dbErrorResponse(e);
  }

  const session = { session_id: turn.session_id, kind: turn.sessions.kind };
  const trial = session.kind === "trial";
  // 본 질문 제출(다시 채점도 같은 turn_id로 남고, 지표는 turn_id로 한 번만 센다).
  // 체험은 회원 지표(답변 제출·세션 완료) 대신 체험 완료만 남긴다
  if (turn.idx === 0 && !trial) {
    await track(
      "answer_submit",
      { ...session, turn_id: id, dont_know: dontKnow },
      userId ?? null,
    );
  }
  const completed = (r: TurnResult) =>
    r.session.status !== "done"
      ? undefined
      : trial
        ? track("trial_complete", { session_id: session.session_id }, null)
        : track("session_complete", session, userId ?? null);

  if (dontKnow) {
    const result = await turnResult(db, id);
    await completed(result);
    return Response.json(result);
  }

  const q = turn.sessions.questions;
  const keys = q.question_keys;
  if (!keys) return gradingFailedJson(db, id);
  const rubric = keys.rubric as Rubric;

  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let open = true;
  const stream = new ReadableStream<Uint8Array>({
    start: (c) => void (controller = c),
    cancel: () => void (open = false),
  });
  const send = (event: string, payload: unknown) => {
    if (!open) return;
    try {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
      );
    } catch {
      open = false;
    }
  };

  const onText = (delta: string) => send("delta", { text: delta });
  // 본 질문은 점수(Sonnet), 꼬리질문은 판정(Haiku). 둘 다 다음 꼬리질문을 함께 만든다(08 설계 "핵심 흐름")
  const gradeTurn = async () => {
    if (turn.idx === 0) {
      // 프로젝트 질문은 세부 주제·난이도 대신 프로젝트 이름(docs/09 "채점 사용자 메시지")
      const topic =
        q.projects || !q.topics
          ? { projectName: q.projects?.name ?? "" }
          : {
              field: q.topics.field,
              topicName: q.topics.name,
              level: q.level ?? "",
            };
      const out = await grade(
        {
          question: q.prompt,
          ...topic,
          rubric,
          modelAnswer: keys.model_answer,
          answer: text,
        },
        onText,
      );
      return toGrading(out, rubric.keywords);
    }
    const input: FollowUpInput = {
      question: q.prompt,
      rubric,
      modelAnswer: keys.model_answer,
      ...(await sessionTurns(db, turn.session_id, turn.idx, text)),
    };
    return toFollowUpGrading(await gradeFollowUp(input, onText), turn.idx);
  };

  // 사용자가 떠나 스트림이 끊겨도 채점과 저장은 끝까지 한다(08 설계 "사용자가 떠나도 저장한다")
  const job = (async () => {
    let saved = false;
    try {
      const result = await gradeTurn();
      if (!result) throw new GradingError("schema_invalid");
      await db
        .rpc("save_grading", { p_turn_id: id, p_result: result })
        .throwOnError();
      saved = true;
      const r = await turnResult(db, id);
      send("result", r);
      await completed(r);
    } catch (e) {
      // 저장은 끝났고 결과 조회만 실패했다. 채점 실패로 되돌리지 않고 새로고침으로 다시 읽게 한다
      if (saved) {
        console.error("grading result read failed", id, e);
        send("error", {
          code: "INTERNAL",
          message: "결과를 불러오지 못했어요. 새로고침해 주세요.",
        });
        return;
      }
      console.error("grading failed", id, e);
      await db.rpc("save_grading", { p_turn_id: id, p_result: null });
      send("error", {
        code: "AI_FAILED",
        message: "채점하지 못했어요. 다시 채점해 주세요.",
      });
    } finally {
      if (open) controller.close();
    }
  })();
  after(job);

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}

async function gradingFailedJson(
  db: ReturnType<typeof createAdminClient>,
  id: string,
) {
  console.error("question_keys missing", id);
  await db.rpc("save_grading", { p_turn_id: id, p_result: null });
  return errorResponse(
    502,
    "AI_FAILED",
    "채점하지 못했어요. 다시 채점해 주세요.",
  );
}

// 꼬리질문 채점에 넣을 지금까지의 턴(docs/09 "꼬리질문 채점 사용자 메시지"의 <history>·<current>)
async function sessionTurns(
  db: ReturnType<typeof createAdminClient>,
  sessionId: string,
  idx: number,
  answer: string,
): Promise<Pick<FollowUpInput, "main" | "previous" | "current">> {
  const { data } = await db
    .from("turns")
    .select(
      "idx, follow_up_prompt, answer, score, verdict, feedback, turn_keys(expected_answer)",
    )
    .eq("session_id", sessionId)
    .lte("idx", idx)
    .order("idx")
    .throwOnError();
  const asTurn = (t: (typeof data)[number]) => ({
    question: t.follow_up_prompt ?? "",
    expectedAnswer: t.turn_keys?.expected_answer ?? "",
    answer: t.answer ?? "",
  });
  const [main, ...rest] = data;
  const current = rest.pop();
  if (main?.idx !== 0 || current?.idx !== idx || !current.turn_keys) {
    throw new Error(`session turns missing: ${sessionId} ${idx}`);
  }
  return {
    main: {
      answer: main.answer ?? "",
      score: main.score ?? 0,
      improve: (main.feedback as { improve?: string[] } | null)?.improve ?? [],
    },
    previous: rest.map((t) => ({
      ...asTurn(t),
      verdict: t.verdict ?? "",
      feedback: (t.feedback as { summary?: string } | null)?.summary ?? "",
    })),
    current: { idx, ...asTurn(current), answer },
  };
}
