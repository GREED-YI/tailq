import Link from "next/link";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "./AppNav";
import { Icon } from "./icons";

// 운영자인지(ADMIN_USER_IDS). 메뉴를 보일지만 정하고, 데이터 접근은 /admin 화면이 다시 확인한다
async function viewerIsAdmin() {
  const { data } = await (await createClient()).auth.getClaims();
  return isAdmin(data?.claims.sub, process.env.ADMIN_USER_IDS);
}

// 탭 화면 메뉴. 운영자면 PC 사이드 메뉴에 "운영"이 붙는다
export async function AppNavForViewer({ sub }: { sub?: boolean }) {
  return <AppNav sub={sub} admin={await viewerIsAdmin()} />;
}

// 모바일·태블릿 헤더의 운영 대시보드 아이콘(운영자에게만). PC는 헤더를 숨기고 사이드 메뉴를 쓴다
export async function AdminHeaderLink() {
  if (!(await viewerIsAdmin())) return null;
  return (
    <Link
      href="/admin"
      className="glass press icon-btn"
      aria-label="운영 대시보드"
    >
      <Icon name="shield" />
    </Link>
  );
}
