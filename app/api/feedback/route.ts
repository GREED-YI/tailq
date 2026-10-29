import { NextResponse } from "next/server";
import { FEEDBACK_DAILY, FeedbackBody, FeedbackCategory } from "@/lib/feedback";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, withApiErrors } from "@/lib/server/api-error";

// 피드백 보내기(04 기능 명세 12장) { body, category? }. 로그인을 확인한 뒤 서버 전용 권한으로 그 사용자 행만 넣는다
export const POST = withApiErrors(async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return errorResponse("UNAUTHORIZED", "로그인이 필요해요.");

  const body = await request.json().catch(() => null);
  const parsed = FeedbackBody.safeParse(body?.body);
  if (!parsed.success)
    return errorResponse("VALIDATION", "5~1000자로 적어 주세요.");
  const category = FeedbackCategory.safeParse(body?.category);
  if (!category.success)
    return errorResponse("VALIDATION", "분류를 다시 골라 주세요.");

  // 하루 개수 확인과 넣기는 사용자별 잠금이 걸린 DB 함수 하나로 한다(동시 요청에도 한도를 넘지 않게)
  const { error } = await createAdminClient().rpc("send_feedback", {
    p_user_id: userId,
    p_body: parsed.data,
    p_daily: FEEDBACK_DAILY,
    p_category: category.data,
  });
  if (error?.message === "FEEDBACK_LIMIT")
    return errorResponse(
      "FEEDBACK_LIMIT",
      "오늘 보낼 수 있는 피드백을 다 보냈어요. 내일 다시 보내 주세요.",
    );
  if (error) return errorResponse("INTERNAL", "보내지 못했어요.");

  return new NextResponse(null, { status: 201 });
});
