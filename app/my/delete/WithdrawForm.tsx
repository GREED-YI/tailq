"use client";

import { useRef, useState } from "react";
import { BackButton } from "@/components/BackButton";
import f from "@/components/Flow.module.css";
import { WITHDRAW_PHRASE } from "@/lib/account";
import { providerName } from "@/lib/profile";
import s from "../my.module.css";

const GONE = [
  "학습 기록, 답변과 채점 결과",
  "복습 일정과 꼬리잇기",
  "내 프로젝트와 프로젝트 질문",
  "알림 구독",
];
const OAUTH = ["github", "google", "kakao"];

export function WithdrawForm(props: { provider: string }) {
  const [text, setText] = useState("");
  // 서버(DELETE /api/me)가 "로그인한 지 24시간이 지났다(REAUTH)"고 답했을 때만 켠다
  const [reauth, setReauth] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const loginForm = useRef<HTMLFormElement>(null);
  const typed = text.trim() === WITHDRAW_PHRASE;

  async function withdraw() {
    setError("");
    // 서버가 다시 확인을 요구했으면 같은 소셜 로그인으로 확인하고 이 화면으로 돌아온다
    if (reauth) {
      if (!OAUTH.includes(props.provider))
        return setError("다시 로그인한 뒤 탈퇴해 주세요.");
      return loginForm.current?.submit();
    }
    setBusy(true);
    const res = await fetch("/api/me", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: WITHDRAW_PHRASE }),
    }).catch(() => null);
    if (res?.status === 204) {
      // 로그인 쿠키가 지워졌으니 화면을 새로 받아 랜딩으로 간다
      window.location.replace("/");
      return;
    }
    const body = await res?.json().catch(() => null);
    if (body?.error?.code === "REAUTH") setReauth(true);
    setError(body?.error?.message ?? "탈퇴하지 못했어요. 다시 시도해 주세요.");
    setBusy(false);
  }

  return (
    <>
      <header className={`${f.top} ${s.top}`}>
        <BackButton className={`${f.back} ${s.back}`} />
        <p className={f.topTitle}>탈퇴하기</p>
      </header>

      <h1 className={s.goneTitle}>
        탈퇴하면 모든 기록이
        <br />
        지워져요
      </h1>
      <ol className={s.gone}>
        {GONE.map((g, i) => (
          <li key={g}>
            <span className="mono">0{i + 1}</span>
            {g}
          </li>
        ))}
      </ol>
      <p className={s.warn}>되돌릴 수 없어요.</p>

      <label htmlFor="confirm" className={`${s.label} ${s.gap}`}>
        확인을 위해 &apos;{WITHDRAW_PHRASE}&apos;를 입력해주세요
      </label>
      <input
        id="confirm"
        className={s.input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={WITHDRAW_PHRASE}
        autoComplete="off"
      />
      {error && (
        <p role="alert" className={s.alert}>
          {error}
        </p>
      )}

      <div className={`${f.bottom} ${s.withdrawBottom}`}>
        <button
          type="button"
          className="btn btn-danger press"
          disabled={!typed || busy}
          aria-busy={busy || undefined}
          onClick={withdraw}
        >
          {reauth
            ? `${providerName(props.provider)} 로그인으로 확인하기`
            : "탈퇴하기"}
        </button>
      </div>

      <form ref={loginForm} action="/auth/login" method="post" hidden>
        <input type="hidden" name="provider" value={props.provider} />
        <input type="hidden" name="next" value="/my/delete" />
        <input type="hidden" name="reauth" value="1" />
      </form>
    </>
  );
}
