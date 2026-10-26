import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 로그인해야 들어가는 탭 화면(app/(app))
const APP_PATHS = ["/home", "/review", "/history", "/projects", "/my"];

// 요청마다 로그인 세션을 갱신하고, 로그인 안 한 사람이 탭 화면에 오면 로그인으로 보낸다.
// 데이터는 RLS가 지키므로 여기서는 화면 이동만 막는다.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const { pathname, search } = request.nextUrl;
  const needsLogin = APP_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!data?.claims && needsLogin) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(url);
    // 만료된 세션 쿠키를 지우는 값도 함께 보낸다
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // 정적 파일과 이미지는 건너뛴다
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
