import type { Metadata } from "next";
import { Suspense } from "react";
import f from "@/components/Flow.module.css";
import { createClient } from "@/lib/supabase/server";
import s from "../my.module.css";
import { WithdrawForm } from "./WithdrawForm";

export const metadata: Metadata = { title: "탈퇴하기 · TailQ" };

// 탈퇴(S29). 지워지는 데이터 안내 → '탈퇴합니다' 입력 → 즉시 삭제·로그아웃(05 사용자 흐름 6장).
// 로그인한 지 24시간이 지났는지는 DELETE /api/me가 서버에서 보고, 그때만(REAUTH) 같은 소셜 로그인으로
// 다시 확인하라고 안내한다. 재확인 로그인은 /auth/callback?next=/my/delete로 이 화면에 돌아온다.
export default function DeletePage() {
  return (
    <main className={`${f.main} ${s.main}`}>
      <Suspense>
        <Withdraw />
      </Suspense>
    </main>
  );
}

async function Withdraw() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  return (
    <WithdrawForm provider={String(claims?.app_metadata?.provider ?? "")} />
  );
}
