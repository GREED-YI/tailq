import { after } from "next/server";
import { z } from "zod";
import { grade, GradingError } from "@/lib/ai";
import { toGrading, type Rubric } from "@/lib/grading";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { dbErrorResponse, errorResponse, turnResult } from "@/lib/turn";

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
  if (!userId) return errorResponse(401, "UNAUTHORIZED", "로그인이 필요해요.");

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
      "idx, sessions(user_id, questions(prompt, level, topics(name, field), question_keys(rubric, model_answer)))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!turn) return errorResponse(404, "NOT_FOUND", "질문을 찾을 수 없어요.");
  if (turn.sessions.user_id !== userId) {
    return errorResponse(403, "NOT_OWNER", "내 질문이 아니에요.");
  }
  // 꼬리질문 답변과 판정은 꼬리질문 세션에서 붙인다
  if (turn.idx !== 0) {
    return errorResponse(
      400,
      "VALIDATION",
      "꼬리질문 답변은 아직 받지 않아요.",
    );
  }

  try {
    await db
      .rpc("submit_answer", {
        p_turn_id: id,
        p_user_id: userId,
        p_answer: text,
        p_dont_know: dontKnow,
      })
      .throwOnError();
  } catch (e) {
    return dbErrorResponse(e);
  }

  if (dontKnow) return Response.json(await turnResult(db, id));

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

  // 사용자가 떠나 스트림이 끊겨도 채점과 저장은 끝까지 한다(08 설계 "사용자가 떠나도 저장한다")
  const job = (async () => {
    try {
      const out = await grade(
        {
          question: q.prompt,
          field: q.topics.field,
          topicName: q.topics.name,
          level: q.level,
          rubric,
          modelAnswer: keys.model_answer,
          answer: text,
        },
        (delta) => send("delta", { text: delta }),
      );
      const result = toGrading(out, rubric.keywords);
      if (!result) throw new GradingError("schema_invalid");
      await db
        .rpc("save_grading", { p_turn_id: id, p_result: result })
        .throwOnError();
      send("result", await turnResult(db, id));
    } catch (e) {
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
