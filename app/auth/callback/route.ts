import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safe-next";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readAnonId, record } from "@/lib/server/track";
import { TRIAL_COOKIE } from "@/lib/trial";

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
      await adoptTrial(data.user.id);
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

// 체험 이어받기(08 설계 "체험과 이어받기"): 오늘 이 브라우저에서 체험했고 처음 가입한 사용자면
// 체험 세션을 첫 기록(오늘의 질문)으로 넘긴다. 조건은 adopt_trial이 본다. 실패해도 로그인은 이어간다
async function adoptTrial(userId: string) {
  const jar = await cookies();
  const token = jar.get(TRIAL_COOKIE)?.value;
  if (!token) return;
  const { error } = await createAdminClient().rpc("adopt_trial", {
    p_user_id: userId,
    p_trial_token: token,
  });
  if (error) {
    console.error("trial adopt failed", error);
    return;
  }
  // 회원이 된 브라우저에는 체험 토큰이 더 필요 없다
  jar.delete(TRIAL_COOKIE);
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
