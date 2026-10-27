import { after, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safe-next";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readAnonId, record } from "@/lib/track";

// 소셜 로그인에서 돌아오는 곳. 받은 코드를 세션으로 바꾸고 next로 보낸다.
// 처음 로그인이면 auth.users 트리거(handle_new_user)가 프로필을 만든다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await trackSignup(data.user.id);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  // 취소했거나 코드가 잘못됐다
  const failed = new URL("/login", url.origin);
  failed.searchParams.set("error", "auth");
  failed.searchParams.set("next", next);
  return NextResponse.redirect(failed);
}

// 첫 로그인(온보딩 전)이면 가입으로 센다. 온보딩을 마치기 전에 다시 로그인하면 한 번 더 남지만
// 지표(metrics_weekly)는 사용자마다 첫 가입만 센다. 확인과 기록은 응답을 보낸 뒤에 한다
async function trackSignup(userId: string) {
  const anonId = await readAnonId();
  after(async () => {
    const { data } = await createAdminClient()
      .from("profiles")
      .select("onboarded_at")
      .eq("id", userId)
      .maybeSingle();
    if (data && !data.onboarded_at) await record("signup", {}, userId, anonId);
  });
}
