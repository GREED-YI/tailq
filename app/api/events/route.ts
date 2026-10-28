import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import {
  ANON_COOKIE,
  ANON_MAX_AGE,
  CLIENT_EVENTS,
  countsAsEvent,
  parseAnonId,
} from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { record } from "@/lib/track";
import { errorResponse, withApiErrors } from "@/lib/api-error";

const Body = z.strictObject({ name: z.enum(CLIENT_EVENTS) });

// 브라우저가 보내는 지표 이벤트(08 설계 4장). 로그인하지 않아도 된다. 이름은 허용 목록만,
// 개수는 record_event가 브라우저당 하루 200건으로 막는다. 브라우저 무작위 값이 없으면 여기서 처음 준다.
export const POST = withApiErrors(async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return errorResponse("VALIDATION", "보낼 수 없는 이벤트예요.");
  }

  const { data } = await (await createClient()).auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  const jar = await cookies();
  const existing = parseAnonId(jar.get(ANON_COOKIE)?.value);
  const anonId = existing ?? crypto.randomUUID();
  if (!existing) {
    jar.set(ANON_COOKIE, anonId, {
      maxAge: ANON_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  const { name } = body.data;
  if (countsAsEvent(name, Boolean(existing), userId)) {
    after(() => record(name, {}, userId, anonId));
  }
  return new NextResponse(null, { status: 204 });
});
