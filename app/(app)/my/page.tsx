import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isAdmin } from "@/lib/admin";
import { FEEDBACK_URL } from "@/lib/links";
import { FIELDS, LEVELS, providerName } from "@/lib/profile";
import { ticketsLeft } from "@/lib/streak";
import { loadStudy } from "@/lib/study";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton, NotifyRow, ThemeRow } from "./MySettings";
import s from "./my.module.css";

export const metadata: Metadata = { title: "MY · TailQ" };

// MY(S27): 프로필, 꼬리잇기·휴식권·북마크 요약, 학습·설정·정보 목록, 로그아웃·탈퇴(04 기능 명세 11장)
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
        <My />
      </Suspense>
    </div>
  );
}

// RLS가 자기 프로필·북마크만 보여준다. 로그인 방법은 로그인 토큰에서 읽는다
async function My() {
  const supabase = await createClient();
  const [{ data: auth }, { data: profile }, topics, bookmarks, study, subs] =
    await Promise.all([
      supabase.auth.getClaims(),
      supabase
        .from("profiles")
        .select("nickname, avatar, topics, levels, notify_on, notify_hour")
        .maybeSingle(),
      supabase.from("topics").select("id, field"),
      supabase.from("bookmarks").select("*", { count: "exact", head: true }),
      loadStudy().catch(() => null),
      // 알림을 끌 때 이 기기의 구독 id를 endpoint로 찾는다
      supabase.from("push_subscriptions").select("id, endpoint"),
    ]);
  const nickname = profile?.nickname ?? "";
  const picked = new Set(profile?.topics);
  // 예: 공통 CS 3 · 백엔드 3 · 기본, 중급
  const range = [
    ...FIELDS.map((f) => {
      const n = (topics.data ?? []).filter(
        (t) => t.field === f.id && picked.has(t.id),
      ).length;
      return n > 0 ? `${f.label} ${n}` : "";
    }),
    LEVELS.filter((l) => profile?.levels.includes(l.id))
      .map((l) => l.label)
      .join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <section className={s.profile} aria-label="프로필">
        <Avatar
          avatar={profile?.avatar ?? null}
          nickname={nickname}
          size={56}
        />
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

      <section className={s.stats} aria-label="요약">
        <Stat
          label="꼬리잇기"
          value={study?.streak.current}
          unit="일째"
          accent
        />
        <Stat
          label="휴식권"
          value={study && ticketsLeft(study.streak.restDays, study.today)}
          unit="개"
        />
        <Stat label="북마크" value={bookmarks.count} unit="개" />
      </section>

      <Group title="학습">
        <Row
          href="/history?filter=bookmark"
          title="북마크"
          meta="면접 직전에 몰아 보기"
        />
        <Row href="/my/range" title="연습 범위" meta={range || "고르지 않음"} />
      </Group>

      <Group title="설정">
        <NotifyRow
          on={profile?.notify_on ?? false}
          hour={profile?.notify_hour ?? 8}
          vapidKey={process.env.VAPID_PUBLIC_KEY ?? ""}
          subscriptions={subs.data ?? []}
        />
        <ThemeRow />
      </Group>

      {/* 운영자에게만 보인다(ADMIN_USER_IDS) */}
      {isAdmin(auth?.claims.sub, process.env.ADMIN_USER_IDS) && (
        <Group title="운영">
          <Row href="/admin" title="운영 대시보드" meta="운영자에게만 보여요" />
        </Group>
      )}

      <Group title="정보">
        <Row href="/terms" title="이용약관" />
        <Row href="/privacy" title="개인정보처리방침" />
        <Row
          href={FEEDBACK_URL}
          title="피드백 보내기"
          meta="의견을 들려주세요"
        />
      </Group>

      <div className={s.account}>
        <LogoutButton />
        <Link
          href="/my/delete"
          className={`btn btn-md btn-danger glass press ${s.accountBtn}`}
        >
          탈퇴하기
        </Link>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div className={`glass ${s.stat}`}>
      <span>{label}</span>
      <strong>
        <span className={`mono ${accent ? s.accent : ""}`}>{value ?? "–"}</span>{" "}
        {unit}
      </strong>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.group} aria-label={title}>
      <h2>{title}</h2>
      <ul className={`glass ${s.list}`}>{children}</ul>
    </section>
  );
}

// 목록 한 줄(제목 15 Bold + 설명 12 + 오른쪽 화살표). 바깥 주소는 새 탭으로
function Row({
  href,
  title,
  meta,
}: {
  href: string;
  title: string;
  meta?: string;
}) {
  const body = (
    <>
      <span className={s.rowText}>
        <strong>{title}</strong>
        {meta && <span className="num">{meta}</span>}
      </span>
      <Icon name="chevronRight" size={18} />
    </>
  );
  return (
    <li>
      {href.startsWith("http") ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={s.row}
        >
          {body}
        </a>
      ) : (
        <Link href={href} className={`hover-row ${s.row}`}>
          {body}
        </Link>
      )}
    </li>
  );
}
