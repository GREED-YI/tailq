import { NextResponse } from "next/server";
import { startDailySession } from "@/lib/daily";
import { createClient } from "@/lib/supabase/server";

const error = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

// 세션 만들기(08 설계 4장). 지금은 오늘의 질문({ kind: "daily" })만 받는다.
// 여러 번 불러도 같은 날에는 같은 세션을 돌려준다.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return error(401, "UNAUTHORIZED", "로그인이 필요해요.");

  const body: unknown = await request.json().catch(() => null);
  if ((body as { kind?: unknown } | null)?.kind !== "daily") {
    return error(400, "VALIDATION", "kind는 daily여야 해요.");
  }

  let session;
  try {
    session = await startDailySession(userId);
  } catch (e) {
    console.error("startDailySession failed", e);
    return error(500, "INTERNAL", "오늘의 질문을 만들지 못했어요.");
  }
  // exhausted면 화면이 "범위 안의 새 질문을 다 풀었어요. 범위를 넓혀볼까요?"를 보여준다
  return NextResponse.json({
    session,
    exhausted: session === null || session.pick === "advance",
  });
}
