import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LEVELS, type Level } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "./OnboardingFlow";

export const metadata: Metadata = { title: "시작하기 · TailQ" };

// 첫 로그인 뒤 한 번 거치는 온보딩(S06 동의 → S07 연습 범위 → S08 알림).
// 로그인·온보딩 여부에 따른 이동은 proxy.ts가 한다.
export default function OnboardingPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "0 20px 40px",
        maxWidth: 520,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Logo />
        <ThemeToggle />
      </header>
      <Suspense>
        <Onboarding />
      </Suspense>
    </main>
  );
}

async function Onboarding() {
  const supabase = await createClient();
  // RLS가 자기 프로필만 보여준다
  const [{ data: profile }, { data: topics }] = await Promise.all([
    supabase
      .from("profiles")
      .select("agreed_at, topics, levels, notify_hour")
      .maybeSingle(),
    supabase.from("topics").select("id, field, name").order("sort"),
  ]);
  if (!profile || !topics) redirect("/login");

  // 나갔다 들어오면 멈춘 단계부터(05 사용자 흐름 "예외 상황")
  const step = !profile.agreed_at ? 0 : profile.topics.length === 0 ? 1 : 2;

  return (
    <OnboardingFlow
      initialStep={step}
      topics={topics}
      initialTopics={profile.topics}
      // 처음엔 난이도를 모두 골라 둔다. 저장된 값은 DB 제약(profiles_levels_known)이 지킨다
      initialLevels={
        profile.levels.length > 0
          ? (profile.levels as Level[])
          : LEVELS.map((l) => l.id)
      }
      initialHour={profile.notify_hour}
    />
  );
}
