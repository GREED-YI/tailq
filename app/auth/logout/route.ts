import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 이 기기에서만 로그아웃하고 랜딩으로 보낸다(다른 기기의 로그인은 그대로)
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/", request.url), 303);
}
