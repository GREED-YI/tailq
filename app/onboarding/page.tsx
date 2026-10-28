import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import f from "@/components/Flow.module.css";
import { Logo } from "@/components/Logo";
import { LEVELS, type Level } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "./OnboardingFlow";

export const metadata: Metadata = { title: "시작하기 · TailQ" };

// 첫 로그인 뒤 한 번 거치는 온보딩(S06 동의 → S07 연습 범위). 알림은 첫 세션을 마친 뒤 홈에서 묻는다.
// 로그인·온보딩 여부에 따른 이동은 proxy.ts가 한다.
export default function OnboardingPage() {
  return (
    <main className={f.main}>
      <span className={f.pcLogo}>
        <Logo />
      </span>
      <Suspense>
        <Onboarding />
      </Suspense>
    </main>
  );
}

async function Onboarding() {
  const supabase = await createClient();
  // RLS가 자기 프로필만 보여준다
  const [{ data: profile }, { data: topics }, { data: adopted }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("agreed_at, topics, levels")
        .maybeSingle(),
      supabase.from("topics").select("id, field, name").order("sort"),
      // 온보딩 전에는 세션이 없고, 체험을 이어받았으면 그 세션 하나뿐이다. 연습 범위에 체험한 분야를 미리 고른다(04 기능 명세 10번)
      supabase
        .from("sessions")
        .select("questions(trial_field)")
        .eq("kind", "daily")
        .limit(1)
        .maybeSingle(),
    ]);
  if (!profile || !topics) redirect("/login");
  const trialField = adopted?.questions?.trial_field;

  // 나갔다 들어오면 멈춘 단계부터(05 사용자 흐름 "예외 상황"). 예전 3단계(알림)에서 멈춘 사람은
  // 범위가 미리 채워진 2단계에서 "시작하기"를 누르면 끝난다
  const step = !profile.agreed_at ? 0 : 1;

  return (
    <OnboardingFlow
      initialStep={step}
      topics={topics}
      initialTopics={
        profile.topics.length === 0 && trialField
          ? topics.filter((t) => t.field === trialField).map((t) => t.id)
          : profile.topics
      }
      // 처음엔 난이도를 모두 골라 둔다. 저장된 값은 DB 제약(profiles_levels_known)이 지킨다
      initialLevels={
        profile.levels.length > 0
          ? (profile.levels as Level[])
          : LEVELS.map((l) => l.id)
      }
    />
  );
}
