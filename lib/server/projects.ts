import "server-only";
import { generateProjectQuestions, GradingError } from "@/lib/server/ai";
import {
  errorResponse,
  INTERNAL_MESSAGE,
  type ErrorCode,
} from "@/lib/server/api-error";
import type { Json } from "@/lib/database.types";
import { toProjectQuestions } from "@/lib/project-questions";
import { MAX_PROJECTS } from "@/lib/questions";
import type { createAdminClient } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, recordUsage } from "@/lib/server/usage";

type Admin = ReturnType<typeof createAdminClient>;

// 질문 5개를 만들어 저장한다(08 설계 "내 프로젝트 질문 생성"). 등록·다시 생성 라우트가 after()에서 부른다.
// 실패해도 던지지 않고 failed + 에러 코드로 남긴다. 그사이 프로젝트가 지워졌으면 저장이 NOT_FOUND로 끝난다.
export async function generateAndSave(
  db: Admin,
  project: { id: string; user_id: string; name: string; content: string },
) {
  let questions = null;
  let code = "schema_invalid";
  try {
    // 등록할 때 잡아 둔 몫을 첫 생성이 쓰고, 다시 생성은 새 행으로 남는다
    questions = toProjectQuestions(
      await generateProjectQuestions(
        { name: project.name, content: project.content },
        (u) =>
          recordUsage(
            db,
            {
              userId: project.user_id,
              purpose: "project_gen",
              refId: project.id,
            },
            u,
          ),
      ),
    );
  } catch (e) {
    console.error("project generation failed", project.id, e);
    code = e instanceof GradingError ? e.reason : "ai_failed";
  }
  const { error } = await db.rpc("save_project_questions", {
    p_project_id: project.id,
    p_questions: questions as Json,
    p_error_code: code,
  });
  if (error) console.error("project questions save failed", project.id, error);
}

// DB 함수가 던진 에러 코드 → 메시지. HTTP 상태는 lib/api-error의 목록이 정한다(08 설계 "에러 형식")
const MESSAGES: Partial<Record<ErrorCode, string>> = {
  NOT_FOUND: "프로젝트를 찾을 수 없어요.",
  NOT_OWNER: "내 프로젝트가 아니에요.",
  NOT_FAILED: "질문을 이미 만들었거나 만들고 있어요.",
  PROJECT_LIMIT: `프로젝트는 ${MAX_PROJECTS}개까지 등록할 수 있어요.`,
  PROJECT_IN_TODAY_SESSION:
    "오늘의 질문으로 나온 프로젝트는 내일 지울 수 있어요",
  LIMIT_EXCEEDED: LIMIT_MESSAGE,
  BUDGET_EXCEEDED: LIMIT_MESSAGE,
};

export function projectErrorResponse(e: unknown) {
  const code = (e as { message?: string } | null)?.message as ErrorCode;
  const message = MESSAGES[code];
  if (message) return errorResponse(code, message);
  console.error("project write failed", e);
  return errorResponse("INTERNAL", INTERNAL_MESSAGE);
}
