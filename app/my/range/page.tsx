import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import f from "@/components/Flow.module.css";
import { RangeSkeleton } from "@/app/onboarding/OnboardingFlow";
import type { Level } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import s from "../my.module.css";
import { MyLoading } from "../MyLoading";
import { RangeEditor } from "./RangeEditor";

export const metadata: Metadata = { title: "연습 범위 · TailQ" };

// MY → 연습 범위 바꾸기. 고르는 화면은 온보딩 S07과 같다(Figma에 따로 그린 화면이 없다)
export default function RangePage() {
  return (
    <div className={s.main}>
      <Suspense
        fallback={
          <MyLoading title="연습 범위">
            <p className={f.sub}>여러 개 고를 수 있어요</p>
            <RangeSkeleton />
          </MyLoading>
        }
      >
        <Range />
      </Suspense>
    </div>
  );
}

async function Range() {
  const supabase = await createClient();
  const [{ data: profile }, { data: topics }] = await Promise.all([
    supabase.from("profiles").select("topics, levels").maybeSingle(),
    supabase.from("topics").select("id, field, name").order("sort"),
  ]);
  if (!profile || !topics) redirect("/login?next=/my/range");
  return (
    <RangeEditor
      topics={topics}
      initialTopics={profile.topics}
      initialLevels={profile.levels as Level[]}
    />
  );
}
