import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, withApiErrors } from "@/lib/api-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 알림 구독 해제(08 설계 4장). 자기 구독만 지우고, 이미 없어도 같은 응답이다(멱등)
export const DELETE = withApiErrors(async function DELETE(
  _: Request,
  ctx: RouteContext<"/api/push-subscriptions/[id]">,
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return errorResponse("UNAUTHORIZED", "로그인이 필요해요.");

  const { id } = await ctx.params;
  if (UUID.test(id)) {
    const { error } = await createAdminClient()
      .from("push_subscriptions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      console.error("push unsubscribe failed", error);
      return errorResponse("INTERNAL", "잠시 뒤에 다시 시도해 주세요.");
    }
  }
  return new NextResponse(null, { status: 204 });
});
