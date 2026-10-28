import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { track } from "@/lib/track";
import {
  clientIp,
  hashIp,
  newTrialToken,
  TRIAL_COOKIE,
  TRIAL_FIELDS,
  trialCookie,
} from "@/lib/trial";
import { budgetUsd, LIMIT_MESSAGE } from "@/lib/usage";
import { errorResponse, withApiErrors } from "@/lib/api-error";

const Body = z.object({ field: z.enum(TRIAL_FIELDS) });

// 체험 시작(08 설계 4장 POST /api/trial-sessions). 같은 브라우저 하루 1번, 같은 IP 하루 20번은 start_trial이 센다.
// 쿠키에 토큰이 없으면 새로 만든다. 오늘 이 브라우저의 체험이 열려 있으면 그 세션을 그대로 돌려준다.
export const POST = withApiErrors(async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return errorResponse("VALIDATION", "분야를 골라 주세요.");
  }

  const jar = await cookies();
  const token = jar.get(TRIAL_COOKIE)?.value || newTrialToken();
  let ipHash: string;
  try {
    ipHash = hashIp(clientIp(request.headers));
  } catch (e) {
    console.error("trial ip hash failed", e);
    return errorResponse("INTERNAL", "잠시 뒤에 다시 시도해 주세요.");
  }

  const { data, error } = await createAdminClient().rpc("start_trial", {
    p_trial_token: token,
    p_ip_hash: ipHash,
    p_field: body.data.field,
    p_budget_usd: budgetUsd(),
  });
  if (error) {
    if (error.message === "TRIAL_LIMIT") {
      return errorResponse("TRIAL_LIMIT", "오늘 체험은 끝났어요");
    }
    // 서비스 월 예산에 닿으면 체험도 시작 전에 막는다(04 기능 명세 12장)
    if (error.message === "BUDGET_EXCEEDED") {
      return errorResponse("BUDGET_EXCEEDED", LIMIT_MESSAGE);
    }
    if (error.message === "NOT_FOUND") {
      return errorResponse(
        "NOT_FOUND",
        "체험 질문을 준비하고 있어요. 잠시 뒤에 다시 시도해 주세요.",
      );
    }
    console.error("trial start failed", error);
    return errorResponse("INTERNAL", "잠시 뒤에 다시 시도해 주세요.");
  }

  // 이어서 하려고 다시 누른 것(이미 있던 세션)은 세지 않는다
  if (Date.now() - Date.parse(data.created_at) < 10_000) {
    await track("trial_start", { field: body.data.field }, null);
  }
  jar.set(
    TRIAL_COOKIE,
    token,
    trialCookie(new URL(request.url).protocol === "https:"),
  );
  return Response.json({ sessionId: data.id }, { status: 201 });
});
