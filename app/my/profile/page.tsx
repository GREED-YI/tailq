import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { socialPhoto } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import s from "../my.module.css";
import { MyLoading } from "../MyLoading";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "프로필 · TailQ" };

// 프로필 편집(S28). 탭이 없는 한 줄 화면이고, 로그인 여부는 proxy.ts가 본다.
export default function ProfilePage() {
  return (
    <div className={s.main}>
      <Suspense fallback={<Loading />}>
        <Profile />
      </Suspense>
    </div>
  );
}

// 불러오는 동안: 아바타 미리보기 72 · 선택지 44 네 개 · 닉네임 칸 자리
function Loading() {
  return (
    <MyLoading title="프로필">
      <p className={s.label}>프로필 이미지</p>
      <div className={s.avatarCard}>
        <span
          className="skeleton"
          style={{ width: 72, height: 72, borderRadius: "50%" }}
        />
        <span className="skeleton" style={{ width: 212, height: 44 }} />
      </div>
      <p className={`${s.label} ${s.gap}`}>닉네임</p>
      <span className="skeleton" style={{ marginTop: 8, height: 52 }} />
    </MyLoading>
  );
}

async function Profile() {
  const supabase = await createClient();
  // RLS가 자기 프로필만 보여준다
  const [{ data: auth }, { data: profile }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("profiles")
      .select("nickname, avatar, share_nickname")
      .maybeSingle(),
  ]);
  if (!profile) redirect("/login?next=/my/profile");

  return (
    <ProfileForm
      nickname={profile.nickname}
      avatar={profile.avatar}
      shareNickname={profile.share_nickname}
      socialPhoto={socialPhoto(auth?.claims.user_metadata)}
    />
  );
}
