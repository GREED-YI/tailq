import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

// 소셜 로그인에서 돌아오는 곳. 받은 코드를 세션으로 바꾸고 next로 보낸다.
// 처음 로그인이면 auth.users 트리거(handle_new_user)가 프로필을 만든다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  // 취소했거나 코드가 잘못됐다
  const failed = new URL("/login", url.origin);
  failed.searchParams.set("error", "auth");
  failed.searchParams.set("next", next);
  return NextResponse.redirect(failed);
}
