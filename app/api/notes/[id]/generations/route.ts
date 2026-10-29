import { after } from "next/server";
import { z } from "zod";
import { generateAndSaveNote, noteErrorResponse } from "@/lib/server/notes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { budgetUsd } from "@/lib/server/usage";
import { errorResponse, withApiErrors } from "@/lib/server/api-error";

export const maxDuration = 300;

// 실패한 학습 자료의 질문 다시 생성(08 설계 4장, #141). failed일 때만 받고, 생성은 등록처럼 뒤에서 한다.
// 월 예산과 다시 만들기 하루 3번(프로젝트와 합쳐, REGEN_LIMIT)을 본다(docs/10 "남용 제한")
export const POST = withApiErrors(async function POST(
  _request: Request,
  ctx: RouteContext<"/api/notes/[id]/generations">,
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return errorResponse("UNAUTHORIZED", "로그인이 필요해요.");

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return errorResponse("NOT_FOUND", "학습 자료를 찾을 수 없어요.");
  }

  const db = createAdminClient();
  let note;
  try {
    note = (
      await db
        .rpc("restart_note_generation", {
          p_user_id: userId,
          p_note_id: id,
          p_budget_usd: budgetUsd(),
        })
        .throwOnError()
    ).data;
  } catch (e) {
    return noteErrorResponse(e);
  }

  after(generateAndSaveNote(db, note));
  return Response.json(
    { note: { id: note.id, status: note.status } },
    { status: 202 },
  );
});
