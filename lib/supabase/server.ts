import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/lib/database.types";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

// 서버 컴포넌트·Route Handler용. 로그인한 사용자 권한으로 읽고 RLS가 자기 행만 보여준다.
export async function createClient() {
  // supabase-js가 세션 만료를 Date.now()로 재므로 미리 렌더링(prefetch 포함)에서 빼고 요청 때만 돈다
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서는 쿠키를 못 쓴다. 세션 갱신은 proxy.ts가 한다
          }
        },
      },
    },
  );
}
