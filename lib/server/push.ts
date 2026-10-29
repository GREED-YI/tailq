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
    body: "오늘도 면접 질문 하나 풀어 볼까요?",
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
// 한 번에 고르는 사람 수와 구독을 읽는 쪽 크기. API 최대 행 수(max_rows 1000)보다 작게 둔다
export const PICK_LIMIT = 100;
const SUBS_PAGE = 1000;
// 응답하지 않는 푸시 서버가 다음 묶음을 막지 않게 요청마다 끊는다
const SEND_TIMEOUT_MS = 10_000;

// 브라우저가 실제로 쓰는 푸시 서비스 주소만 받는다(Chrome·Edge·Firefox·Safari).
// 서버가 이 주소로 요청을 보내므로 아무 주소나 받으면 서버를 통해 다른 곳을 부를 수 있다
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];
export function isPushEndpoint(endpoint: string) {
  const host = new URL(endpoint).hostname;
  return PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

type Db = SupabaseClient<Database>;

// 대상을 PICK_LIMIT명씩 고르고(같은 문장으로 last_notified_day를 적는다) 빈 묶음이 올 때까지 되풀이한다.
// 대상이 0명이어도 rpc 한 번은 친다(무료 Supabase가 쉬어서 멈추지 않게, #20).
// 없어진 구독(404·410)은 지운다. 실패한 발송은 다시 보내지 않는다(그날은 이미 보낸 것으로 친다).
export async function sendDailyPushes(db: Db, now = new Date()) {
  const total = { targets: 0, sent: 0, gone: 0 };
  for (;;) {
    const { data: targets } = await db
      .rpc("pick_push_targets", {
        p_now: now.toISOString(),
        p_limit: PICK_LIMIT,
      })
      .throwOnError();
    if (!targets.length) return total;
    const { sent, gone } = await sendTo(db, targets);
    total.targets += targets.length;
    total.sent += sent;
    total.gone += gone;
    if (targets.length < PICK_LIMIT) return total;
  }
}

// 고른 사람들의 기기에 20개씩 보낸다
async function sendTo(db: Db, targets: { user_id: string; review: boolean }[]) {
  const vapidDetails = {
    subject: process.env.VAPID_SUBJECT ?? "",
    publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  };
  const review = new Map(targets.map((t) => [t.user_id, t.review]));
  const subs = [];
  for (let from = 0; ; from += SUBS_PAGE) {
    const { data: page } = await db
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth_key")
      .in("user_id", [...review.keys()])
      .order("id")
      .range(from, from + SUBS_PAGE - 1)
      .throwOnError();
    subs.push(...page);
    if (page.length < SUBS_PAGE) break;
  }

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
          { vapidDetails, TTL: 4 * 60 * 60, timeout: SEND_TIMEOUT_MS },
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
  return { sent, gone: gone.length };
}
