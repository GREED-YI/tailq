import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import type { Database } from "@/lib/database.types";

// 웹 푸시 발송(#37, 08 설계 "웹 푸시"). 매시 pg_cron → POST /api/cron/push가 부른다.
export const PUSH_BATCH = 20;

// 알림 문구(04 기능 명세 7장). 잠금 화면에 보이므로 닉네임·질문 같은 개인 내용은 넣지 않는다.
// 누르면 홈으로 간다(05 사용자 흐름 "매일 연습": 알림 클릭 → 로그인 → 홈)
export function pushPayload(review: boolean) {
  return JSON.stringify({
    title: review ? "복습할 질문이 있어요" : "오늘의 질문이 도착했어요",
    body: "오늘도 한 문제 풀어볼까요?",
    url: "/home",
  });
}

// pg_cron이 vault의 비밀값을 Authorization: Bearer로 보낸다. 비밀값이 없으면 아무도 통과하지 못한다
export function isCronAuthorized(
  header: string | null,
  secret: string | undefined,
) {
  if (!secret || !header) return false;
  const got = Buffer.from(header);
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

const GONE = [404, 410];

// 대상을 고르고(같은 문장으로 last_notified_day를 적는다) 그 사람들의 기기에 20개씩 보낸다.
// 대상이 0명이어도 rpc 한 번은 친다(무료 Supabase가 쉬어서 멈추지 않게, #20).
// 없어진 구독(404·410)은 지운다. 실패한 발송은 다시 보내지 않는다(그날은 이미 보낸 것으로 친다).
export async function sendDailyPushes(
  db: SupabaseClient<Database>,
  now = new Date(),
) {
  const { data: targets } = await db
    .rpc("pick_push_targets", { p_now: now.toISOString() })
    .throwOnError();
  if (!targets.length) return { targets: 0, sent: 0, gone: 0 };

  const vapidDetails = {
    subject: process.env.VAPID_SUBJECT ?? "",
    publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  };
  const review = new Map(targets.map((t) => [t.user_id, t.review]));
  // ponytail: 대상 id를 한 번에 in()으로 읽는다. 한 시각에 수천 명이 되면 나눠 읽는다
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth_key")
    .in("user_id", [...review.keys()])
    .throwOnError();

  let sent = 0;
  const gone: string[] = [];
  for (let i = 0; i < subs.length; i += PUSH_BATCH) {
    const batch = subs.slice(i, i + PUSH_BATCH);
    const results = await Promise.allSettled(
      batch.map((s) =>
        webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth_key },
          },
          pushPayload(review.get(s.user_id) ?? false),
          // 몇 시간 안에 못 받으면 버린다(오늘의 알림이라 다음 날 받으면 틀린 말이 된다)
          { vapidDetails, TTL: 4 * 60 * 60 },
        ),
      ),
    );
    results.forEach((r, j) => {
      if (r.status === "fulfilled") return sent++;
      const status = (r.reason as { statusCode?: number })?.statusCode;
      if (status && GONE.includes(status)) gone.push(batch[j].id);
      else console.error("push send failed", status ?? r.reason);
    });
  }
  if (gone.length) {
    await db.from("push_subscriptions").delete().in("id", gone).throwOnError();
  }
  return { targets: targets.length, sent, gone: gone.length };
}
