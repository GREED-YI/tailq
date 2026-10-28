import { after } from "next/server";
import { z } from "zod";
import { generateAndSave, projectErrorResponse } from "@/lib/projects";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { budgetUsd } from "@/lib/usage";
import { errorResponse, withApiErrors } from "@/lib/api-error";

export const maxDuration = 300;

// 실패한 프로젝트의 질문 다시 생성(08 설계 4장). failed일 때만 받고, 생성은 등록처럼 뒤에서 한다.
// 하루 한도는 등록 때 잡은 몫을 쓰므로 다시 보지 않고, 월 예산만 본다
export const POST = withApiErrors(async function POST(
  _request: Request,
  ctx: RouteContext<"/api/projects/[id]/generations">,
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return errorResponse("UNAUTHORIZED", "로그인이 필요해요.");

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return errorResponse("NOT_FOUND", "프로젝트를 찾을 수 없어요.");
  }

  const db = createAdminClient();
  let project;
  try {
    project = (
      await db
        .rpc("restart_project_generation", {
          p_user_id: userId,
          p_project_id: id,
          p_budget_usd: budgetUsd(),
        })
        .throwOnError()
    ).data;
  } catch (e) {
    return projectErrorResponse(e);
  }

  after(generateAndSave(db, project));
  return Response.json(
    { project: { id: project.id, status: project.status } },
    { status: 202 },
  );
});
