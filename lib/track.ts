import "server-only";
import { cookies } from "next/headers";
import { after } from "next/server";
import {
  ANON_COOKIE,
  parseAnonId,
  type EventName,
  type EventProps,
} from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

// 이벤트 한 줄을 남긴다. 실패해도 던지지 않는다(지표 때문에 사용자 요청이 실패하면 안 된다)
export async function record<N extends EventName>(
  name: N,
  props: EventProps[N],
  userId: string | null,
  anonId: string | null,
) {
  try {
    const { error } = await createAdminClient().rpc("record_event", {
      p_name: name,
      p_props: props,
      p_user_id: userId ?? undefined,
      p_anon_id: anonId ?? undefined,
    });
    if (error) throw error;
  } catch (e) {
    console.error("event record failed", name, e);
  }
}

export async function readAnonId() {
  return parseAnonId((await cookies()).get(ANON_COOKIE)?.value);
}

// 응답을 보낸 뒤에 남긴다(after). Route Handler·서버 컴포넌트에서 부른다.
// 체험(#40)·공유(#41)·알림(#37)도 이 함수로 trial_start·trial_complete·share를 남긴다
export async function track<N extends EventName>(
  name: N,
  props: EventProps[N],
  userId: string | null,
) {
  try {
    const anonId = await readAnonId();
    after(() => record(name, props, userId, anonId));
  } catch (e) {
    console.error("event track failed", name, e);
  }
}
