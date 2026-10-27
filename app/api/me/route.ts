import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { needsReauth, REAUTH_COOKIE, Withdraw } from "@/lib/account";
import { MeUpdate, socialPhoto, toProfileUpdate } from "@/lib/profile";
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
    const { count, error: topicsError } = await admin
      .from("topics")
      .select("id", { count: "exact", head: true })
      .in("id", input.topics);
    if (topicsError) return fail(500, "INTERNAL", "저장하지 못했어요.");
    if (count !== input.topics.length)
      return fail(400, "VALIDATION", "없는 주제가 있어요.");
  }

  const { error } = await admin
    .from("profiles")
    .update(
      toProfileUpdate(
        input,
        new Date().toISOString(),
        socialPhoto(auth?.claims.user_metadata),
      ),
    )
    .eq("id", userId);
  // 23514: 동의·연습 범위 없이 온보딩을 마치려 함(profiles_onboarded_ready 제약)
  if (error?.code === "23514")
    return fail(400, "VALIDATION", "동의와 연습 범위를 먼저 마쳐 주세요.");
  if (error) return fail(500, "INTERNAL", "저장하지 못했어요.");

  return new NextResponse(null, { status: 204 });
}

// 탈퇴(08 설계 "탈퇴"). '탈퇴합니다' 입력과 로그인 24시간 이내를 서버에서 다시 확인한 뒤
// auth.users의 그 사용자를 지운다. 사용자 테이블은 모두 on delete cascade라 기록이 한 번에 지워진다.
// ai_usage·events 테이블이 생기면 여기서 events 삭제와 ai_usage.user_id 비우기를 더한다(08 설계).
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) return fail(401, "UNAUTHORIZED", "로그인이 필요해요.");

  if (!Withdraw.safeParse(await request.json().catch(() => null)).success)
    return fail(400, "VALIDATION", "'탈퇴합니다'를 입력해 주세요.");
  if (needsReauth(claims))
    return fail(403, "REAUTH", "소셜 로그인으로 한 번 더 확인해 주세요.");
  const jar = await cookies();
  const expected = jar.get(REAUTH_COOKIE)?.value;
  if (expected && expected !== claims.sub)
    return fail(
      403,
      "OTHER_ACCOUNT",
      "처음 가입한 방법으로 다시 로그인해 주세요.",
    );

  const { error } = await createAdminClient().auth.admin.deleteUser(claims.sub);
  if (error) return fail(500, "INTERNAL", "탈퇴하지 못했어요.");

  // 이미 발급된 로그인 토큰이 만료 전까지 살아 있으므로 이 기기의 로그인 쿠키를 바로 지운다
  await supabase.auth.signOut({ scope: "local" });
  jar.delete(REAUTH_COOKIE);
  return new NextResponse(null, { status: 204 });
}
