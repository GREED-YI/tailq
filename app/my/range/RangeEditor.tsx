"use client";

import { useRouter } from "next/navigation";
import { useState, type ComponentProps } from "react";
import { BackButton } from "@/components/BackButton";
import f from "@/components/Flow.module.css";
import { RangeStep } from "@/app/onboarding/OnboardingFlow";
import s from "../my.module.css";

type Props = Omit<ComponentProps<typeof RangeStep>, "onNext" | "label">;

export function RangeEditor(props: Props) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  async function save(body: object) {
    setFailed(false);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) return setFailed(true);
    router.replace("/my");
    router.refresh();
    return true;
  }

  return (
    <>
      <header className={`${f.top} ${s.top}`}>
        <BackButton className={`${f.back} ${s.back}`} />
        <h1 className={f.topTitle}>연습 범위</h1>
      </header>
      <p className={f.sub}>여러 개 고를 수 있어요</p>
      <RangeStep {...props} label="저장" onNext={save} />
      {failed && (
        <p role="alert" className={s.alert}>
          저장하지 못했어요. 다시 시도해 주세요.
        </p>
      )}
    </>
  );
}
