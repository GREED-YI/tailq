import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import f from "@/components/Flow.module.css";
import { socialPhoto } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import s from "../my.module.css";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "프로필 · TailQ" };

// 프로필 편집(S28). 탭이 없는 한 줄 화면이고, 로그인 여부는 proxy.ts가 본다.
export default function ProfilePage() {
  return (
    <main className={`${f.main} ${s.main}`}>
      <Suspense>
        <Profile />
      </Suspense>
    </main>
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
