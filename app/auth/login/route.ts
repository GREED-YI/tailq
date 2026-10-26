import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

const PROVIDERS = ["github", "google", "kakao"] as const;
type Provider = (typeof PROVIDERS)[number];

// 로그인 화면의 버튼이 보낸다. 소셜 로그인 화면으로 보내고, 끝나면 /auth/callback으로 돌아온다.
export async function POST(request: Request) {
  const form = await request.formData();
  const provider = form.get("provider");
  const next = safeNextPath(form.get("next"));
  const { origin } = new URL(request.url);

  if (PROVIDERS.includes(provider as Provider)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        skipBrowserRedirect: true,
      },
    });
    if (!error && data.url) return NextResponse.redirect(data.url, 303);
  }

  const failed = new URL("/login", origin);
  failed.searchParams.set("error", "auth");
  failed.searchParams.set("next", next);
  return NextResponse.redirect(failed, 303);
}
