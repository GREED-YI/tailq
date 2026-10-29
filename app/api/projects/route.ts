import { after } from "next/server";
import { z } from "zod";
import { CONTENT_MAX, CONTENT_MIN, NAME_MAX } from "@/lib/questions";
import { generateAndSave, projectErrorResponse } from "@/lib/server/projects";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { budgetUsd } from "@/lib/server/usage";
import { errorResponse, withApiErrors } from "@/lib/server/api-error";

// 질문 5개 생성은 30~60초 넘게 걸릴 수 있어 after()도 이 시간 안에서 끝낸다(08 설계 "실행 환경")
export const maxDuration = 300;

const Body = z.object({
  name: z.string().trim().min(1).max(NAME_MAX),
  content: z.string().trim().min(CONTENT_MIN).max(CONTENT_MAX),
});

// 프로젝트 등록(08 설계 4장). 3개 제한·월 예산·하루 한도를 확인해 generating으로 저장하고 바로 응답한 뒤, 질문 생성은 뒤에서 한다.
// 화면은 프로젝트 행을 다시 읽어 ready·failed가 됐는지 본다
export const POST = withApiErrors(async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return errorResponse("UNAUTHORIZED", "로그인이 필요해요.");

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return errorResponse(
      "VALIDATION",
      `프로젝트 이름은 ${NAME_MAX}자 이하, README는 ${CONTENT_MIN}자 이상 ${CONTENT_MAX.toLocaleString()}자 이하로 써 주세요.`,
    );
  }

  const db = createAdminClient();
  let project;
  try {
    project = (
      await db
        .rpc("create_project", {
          p_user_id: userId,
          p_name: body.data.name,
          p_content: body.data.content,
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
    { status: 201 },
  );
});
