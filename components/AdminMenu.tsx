import { isAdmin } from "@/lib/admin";
import { loadStudy } from "@/lib/study";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "./AppNav";

// 운영자인지(ADMIN_USER_IDS). 메뉴를 보일지만 정하고, 데이터 접근은 /admin 화면이 다시 확인한다
async function viewerIsAdmin() {
  const { data } = await (await createClient()).auth.getClaims();
  return isAdmin(data?.claims.sub, process.env.ADMIN_USER_IDS);
}

// 탭 화면 머리 막대. 운영자면 "운영" 메뉴가 붙고, 꼬리잇기와 프로필 원을 함께 그린다.
// 꼬리잇기·프로필을 못 읽어도 메뉴는 그린다
export async function AppNavForViewer({ sub }: { sub?: boolean }) {
  const supabase = await createClient();
  const [admin, { data: profile }, study] = await Promise.all([
    viewerIsAdmin(),
    supabase.from("profiles").select("nickname, avatar").maybeSingle(),
    loadStudy().catch(() => null),
  ]);
  return (
    <AppNav
      sub={sub}
      admin={admin}
      streak={study?.streak.current}
      nickname={profile?.nickname ?? ""}
      avatar={profile?.avatar ?? null}
    />
  );
}
