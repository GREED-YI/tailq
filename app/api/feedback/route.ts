import { NextResponse } from "next/server";
import { FEEDBACK_DAILY, FeedbackBody } from "@/lib/feedback";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const fail = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

// 피드백 보내기(04 기능 명세 12장). 로그인을 확인한 뒤 서버 전용 권한으로 그 사용자 행만 넣는다
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return fail(401, "UNAUTHORIZED", "로그인이 필요해요.");

  const body = await request.json().catch(() => null);
  const parsed = FeedbackBody.safeParse(body?.body);
  if (!parsed.success)
    return fail(400, "VALIDATION", "5~1000자로 적어 주세요.");

  const admin = createAdminClient();
  // ponytail: 세고 넣는 사이에 동시에 보내면 한도를 조금 넘을 수 있다. 문제가 되면 DB 함수로 옮긴다
  const { count, error: countError } = await admin
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if (countError) return fail(500, "INTERNAL", "보내지 못했어요.");
  if ((count ?? 0) >= FEEDBACK_DAILY)
    return fail(
      429,
      "FEEDBACK_LIMIT",
      "오늘은 피드백을 충분히 보냈어요. 내일 다시 보내 주세요.",
    );

  const { error } = await admin
    .from("feedback")
    .insert({ user_id: userId, body: parsed.data });
  if (error) return fail(500, "INTERNAL", "보내지 못했어요.");

  return new NextResponse(null, { status: 201 });
}
