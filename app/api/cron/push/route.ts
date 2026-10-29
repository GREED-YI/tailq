import { after, NextResponse } from "next/server";
import { isCronAuthorized, sendDailyPushes } from "@/lib/server/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, withApiErrors } from "@/lib/server/api-error";

// 발송은 after()에서 하므로 응답 뒤에도 이 시간까지 돈다(08 설계 "실행 환경")
export const maxDuration = 60;

// 매시 알림 발송(08 설계 "웹 푸시"). pg_cron + pg_net만 부르는 내부 입구라 비밀 헤더로 막는다.
// pg_net 요청 시간 제한(5초) 때문에 바로 응답하고 발송은 뒤에서 한다.
export const POST = withApiErrors(async function POST(request: Request) {
  if (
    !isCronAuthorized(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return errorResponse("UNAUTHORIZED", "허용되지 않은 요청이에요.");
  }
  after(async () => {
    try {
      console.info("push run", await sendDailyPushes(createAdminClient()));
    } catch (e) {
      console.error("push run failed", e);
    }
  });
  return new NextResponse(null, { status: 202 });
});
