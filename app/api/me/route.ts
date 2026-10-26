import { NextResponse } from "next/server";
import { MeUpdate, toProfileUpdate } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const fail = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

// 내 프로필·설정 바꾸기(08 설계 4장). 로그인한 사용자를 확인한 뒤 서버 전용 권한으로 자기 행만 쓴다.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return fail(401, "UNAUTHORIZED", "로그인이 필요해요.");

  const parsed = MeUpdate.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return fail(400, "VALIDATION", "입력값을 확인해 주세요.");
  const input = parsed.data;

  const admin = createAdminClient();
  if (input.topics) {
    const { count } = await admin
      .from("topics")
      .select("id", { count: "exact", head: true })
      .in("id", input.topics);
    if (count !== input.topics.length)
      return fail(400, "VALIDATION", "없는 주제가 있어요.");
  }

  const { error } = await admin
    .from("profiles")
    .update(toProfileUpdate(input, new Date().toISOString()))
    .eq("id", userId);
  // 23514: 동의·연습 범위 없이 온보딩을 마치려 함(profiles_onboarded_ready 제약)
  if (error?.code === "23514")
    return fail(400, "VALIDATION", "동의와 연습 범위를 먼저 마쳐 주세요.");
  if (error) return fail(500, "INTERNAL", "저장하지 못했어요.");

  return new NextResponse(null, { status: 204 });
}
