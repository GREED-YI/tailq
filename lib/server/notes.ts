import "server-only";
import { generateNoteQuestions, GradingError } from "@/lib/server/ai";
import {
  errorResponse,
  INTERNAL_MESSAGE,
  type ErrorCode,
} from "@/lib/server/api-error";
import type { Json } from "@/lib/database.types";
import { toProjectQuestions } from "@/lib/project-questions";
import { MAX_NOTES } from "@/lib/questions";
import type { createAdminClient } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, recordUsage } from "@/lib/server/usage";

type Admin = ReturnType<typeof createAdminClient>;

// 학습 자료 질문 5개를 만들어 저장한다(08 설계 "학습 자료 질문 생성", lib/server/projects.ts의 generateAndSave와 같은 흐름).
// 실패해도 던지지 않고 failed + 에러 코드로 남긴다. 그사이 학습 자료가 지워졌으면 저장이 NOT_FOUND로 끝난다.
export async function generateAndSaveNote(
  db: Admin,
  note: { id: string; user_id: string; title: string; content: string },
) {
  let questions = null;
  let code = "schema_invalid";
  try {
    questions = toProjectQuestions(
      await generateNoteQuestions(
        { title: note.title, content: note.content },
        (u) =>
          recordUsage(
            db,
            { userId: note.user_id, purpose: "note_gen", refId: note.id },
            u,
          ),
      ),
    );
  } catch (e) {
    console.error("note generation failed", note.id, e);
    code = e instanceof GradingError ? e.reason : "ai_failed";
  }
  const { error } = await db.rpc("save_note_questions", {
    p_note_id: note.id,
    p_questions: questions as Json,
    p_error_code: code,
  });
  if (error) console.error("note questions save failed", note.id, error);
}

// DB 함수가 던진 에러 코드 → 메시지. HTTP 상태는 lib/api-error의 목록이 정한다(08 설계 "에러 형식")
const MESSAGES: Partial<Record<ErrorCode, string>> = {
  NOT_FOUND: "학습 자료를 찾을 수 없어요.",
  NOT_OWNER: "내 학습 자료가 아니에요.",
  NOT_FAILED: "질문을 이미 만들었거나 만들고 있어요.",
  NOTE_LIMIT: `학습 자료는 ${MAX_NOTES}개까지 등록할 수 있어요.`,
  NOTE_IN_TODAY_SESSION: "오늘의 질문으로 나온 학습 자료는 내일 지울 수 있어요",
  LIMIT_EXCEEDED: LIMIT_MESSAGE,
  BUDGET_EXCEEDED: LIMIT_MESSAGE,
};

export function noteErrorResponse(e: unknown) {
  const code = (e as { message?: string } | null)?.message as ErrorCode;
  const message = MESSAGES[code];
  if (message) return errorResponse(code, message);
  console.error("note write failed", e);
  return errorResponse("INTERNAL", INTERNAL_MESSAGE);
}
