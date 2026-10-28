import { NextResponse } from "next/server";
import { z } from "zod";
import { isPushEndpoint } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, withApiErrors } from "@/lib/api-error";

// 브라우저 PushSubscription.toJSON() 모양. 길이는 DB 제약과 같다. 주소는 알려진 푸시 서비스만
const Body = z.object({
  endpoint: z
    .url({ protocol: /^https$/ })
    .max(1000)
    .refine(isPushEndpoint),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

// 알림 구독(08 설계 4장). 같은 endpoint를 다시 보내면 같은 줄을 고친다(멱등).
// 같은 브라우저에서 다른 계정으로 로그인해 구독하면 그 기기는 지금 계정의 것이 된다.
export const POST = withApiErrors(async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return errorResponse("UNAUTHORIZED", "로그인이 필요해요.");

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return errorResponse("VALIDATION", "구독 정보를 확인해 주세요.");
  const { endpoint, keys } = body.data;

  const { data: row, error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint, p256dh: keys.p256dh, auth_key: keys.auth },
      { onConflict: "endpoint" },
    )
    .select("id")
    .single();
  if (error) {
    console.error("push subscribe failed", error);
    return errorResponse("INTERNAL", "잠시 뒤에 다시 시도해 주세요.");
  }
  return NextResponse.json({ id: row.id });
});
