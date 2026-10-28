"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { LimitNotice, type Notice } from "@/components/LimitNotice";
import { CONTENT_MAX, CONTENT_MIN, NAME_MAX } from "@/lib/questions";
import s from "@/app/(app)/projects/projects.module.css";

// 이름과 README를 받아 등록하고, 질문을 만드는 동안 보여줄 질문 목록 화면으로 간다.
// notice가 있으면(오늘 등록 한도·월 예산 소진) 입력칸 대신 안내만 보여준다
export function ProjectForm({ notice }: { notice: Notice | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const length = content.trim().length;
  const valid =
    name.trim().length > 0 && length >= CONTENT_MIN && length <= CONTENT_MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, content }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (res?.ok) {
      router.replace(`/projects/${json.project.id}`);
      return;
    }
    setBusy(false);
    setError(json?.error?.message ?? "잠시 뒤에 다시 시도해 주세요.");
  }

  return (
    <>
      <header className={s.top}>
        <Link
          href="/projects"
          className="press icon-btn"
          aria-label="내 프로젝트로"
        >
          <Icon name="chevronLeft" />
        </Link>
        <h1>프로젝트 등록</h1>
      </header>

      {notice ? (
        <LimitNotice {...notice} />
      ) : (
        <form className={s.form} onSubmit={submit}>
          <label htmlFor="project-name" className={s.label}>
            프로젝트 이름
          </label>
          <input
            id="project-name"
            className={s.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            placeholder="예: 혜자 - 청년 지원금 매칭"
            autoComplete="off"
            required
          />

          <label htmlFor="project-content" className={`${s.label} ${s.gap}`}>
            README 또는 설명
          </label>
          <textarea
            id="project-content"
            className={s.textarea}
            data-over={length > CONTENT_MAX || undefined}
            aria-invalid={length > CONTENT_MAX || undefined}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="README나 프로젝트 설명을 붙여넣어 주세요"
            spellCheck={false}
            aria-describedby="project-help"
            required
          />
          <p
            id="project-help"
            className={s.help}
            data-over={length > CONTENT_MAX || undefined}
          >
            <span className={s.mobileHelp}>
              {length > 0 && length < CONTENT_MIN
                ? `${CONTENT_MIN}자 이상 써 주세요`
                : "README를 넣으면 예상 질문 5개를 만들어 줘요"}
            </span>
            <span className={`num ${s.pcHelp}`}>
              {length > 0 && length < CONTENT_MIN
                ? `${CONTENT_MIN}자 이상 써 주세요`
                : "최대 10,000자까지 붙여넣을 수 있어요"}
            </span>
            <span className="mono">
              {length.toLocaleString()} / {CONTENT_MAX.toLocaleString()}
            </span>
          </p>

          <div className={s.bottom}>
            {error && (
              <p className={s.error} role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary press"
              disabled={!valid || busy}
              aria-busy={busy || undefined}
            >
              {busy ? "등록하고 있어요" : "질문 5개 생성"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
