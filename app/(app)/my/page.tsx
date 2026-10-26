import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { providerName } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import s from "./my.module.css";

export const metadata: Metadata = { title: "MY · TailQ" };

// MY(S27). 프로필 줄은 #27, 설정 목록은 #42에서 채운다. 그전까지 로그아웃만 둔다.
export default function MyPage() {
  return (
    <div className={s.my}>
      <header className={s.header}>
        <h1 className={s.title}>MY</h1>
        <span className={s.mobileOnly}>
          <ThemeToggle />
        </span>
      </header>
      <Suspense fallback={<div className={s.profile} />}>
        <ProfileRow />
      </Suspense>
      <form action="/auth/logout" method="post" style={{ marginTop: 24 }}>
        <button
          type="submit"
          className="btn btn-secondary glass press"
          style={{ width: "100%" }}
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}

// RLS가 자기 프로필만 보여준다. 로그인 방법은 로그인 토큰에서 읽는다
async function ProfileRow() {
  const supabase = await createClient();
  const [{ data: auth }, { data: profile }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("profiles").select("nickname, avatar").maybeSingle(),
  ]);
  const nickname = profile?.nickname ?? "";
  return (
    <section className={s.profile} aria-label="프로필">
      <Avatar avatar={profile?.avatar ?? null} nickname={nickname} size={56} />
      <div className={s.who}>
        <strong>{nickname}</strong>
        <span>
          {providerName(auth?.claims.app_metadata?.provider)}로 로그인
        </span>
      </div>
      <Link href="/my/profile" className={`glass press ${s.edit}`}>
        편집
      </Link>
    </section>
  );
}
