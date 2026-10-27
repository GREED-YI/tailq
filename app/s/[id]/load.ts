import { cache } from "react";
import { SHARE_ID, type ShareCard } from "@/lib/share";
import { createAdminClient } from "@/lib/supabase/admin";

// 공유 카드 한 장. shares에는 읽기 정책이 없어 서버가 id 하나로만 읽고, 카드 칸만 꺼낸다
// (누구의 세션인지는 내보내지 않는다, 08 설계 "공유 · 운영"). 없으면 null.
// 한 요청에서 메타데이터와 화면이 같이 부르므로 cache로 한 번만 읽는다.
export const loadShare = cache(
  async (id: string): Promise<ShareCard | null> => {
    if (!SHARE_ID.test(id)) return null;
    const { data } = await createAdminClient()
      .from("shares")
      .select("nickname, topic_name, score, streak, created_at")
      .eq("id", id)
      .maybeSingle()
      .throwOnError();
    return data;
  },
);
