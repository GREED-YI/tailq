import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { FeedbackLink } from "@/components/FeedbackLink";
import { FloatingQ } from "@/components/FloatingQ";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = { title: "로그인 · TailQ" };

type SearchParams = PageProps<"/login">["searchParams"];

const POINTS = [
  "하루 한 문제, 5분이면 끝",
  "AI 채점과 꼬리질문으로 실전처럼",
  "부족한 질문은 알아서 다시",
];

// 브랜드 색이라 테마가 바뀌어도 그대로 둔다(07 UI 디자인 "버튼 규칙")
const PROVIDERS: {
  id: string;
  label: string;
  style: CSSProperties;
  logo: ReactNode;
}[] = [
  {
    id: "github",
    label: "GitHub로 계속하기",
    // 다크 배경에 묻히지 않게 테두리만 테마 선을 쓴다
    style: {
      background: "#24292F",
      color: "#FFFFFF",
      boxShadow: "inset 0 0 0 1px var(--glass-edge)",
    },
    logo: (
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
      </svg>
    ),
  },
  {
    id: "google",
    label: "Google로 계속하기",
    style: {
      background: "#FFFFFF",
      color: "#1F1F1F",
      boxShadow: "inset 0 0 0 1px #DADCE0",
    },
    logo: (
      <svg viewBox="0 0 18 18">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18"
        />
        <path
          fill="#FBBC05"
          d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58"
        />
      </svg>
    ),
  },
  {
    id: "kakao",
    label: "카카오로 계속하기",
    style: { background: "#FEE500", color: "#000000" },
    logo: (
      <svg viewBox="0 0 18 18" fill="currentColor">
        <path d="M9 1.5c-4.42 0-8 2.8-8 6.25 0 2.22 1.48 4.17 3.71 5.28l-.95 3.45c-.08.3.26.55.52.37l4.1-2.72c.2.02.41.03.62.03 4.42 0 8-2.8 8-6.25S13.42 1.5 9 1.5" />
      </svg>
    ),
  },
];

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "0 20px",
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
        <Link href="/" aria-label="TailQ 첫 화면으로">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <section
        style={{
          marginTop: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 12,
        }}
      >
        <FloatingQ size={120} />
        <h1
          style={{
            fontSize: 28,
            lineHeight: "36px",
            fontWeight: 700,
            letterSpacing: -0.8,
          }}
        >
          TailQ 시작하기
        </h1>
        <p style={{ fontSize: 15, color: "var(--sub)" }}>
          매일 5분, AI 면접관에게 채점과 피드백 받기
        </p>
      </section>

      <ol
        className="glass"
        style={{
          marginTop: 24,
          borderRadius: 24,
          padding: "16px 20px",
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {POINTS.map((point, i) => (
          <li key={point} style={{ display: "flex", gap: 12, fontSize: 15 }}>
            <span className="mono" style={{ color: "var(--accent)" }}>
              0{i + 1}
            </span>
            {point}
          </li>
        ))}
      </ol>

      <Suspense>
        <ErrorNotice searchParams={searchParams} />
      </Suspense>

      <form
        action="/auth/login"
        method="post"
        style={{
          marginTop: 24,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Suspense>
          <NextField searchParams={searchParams} />
        </Suspense>
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="submit"
            name="provider"
            value={p.id}
            className="btn press"
            style={{ ...p.style, position: "relative", width: "100%" }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 20,
                width: 20,
                height: 20,
                display: "flex",
              }}
            >
              {p.logo}
            </span>
            {p.label}
          </button>
        ))}
      </form>

      <p
        style={{
          marginTop: 16,
          fontSize: 13,
          lineHeight: "20px",
          color: "var(--sub)",
          textAlign: "center",
        }}
      >
        이메일이 같은 로그인 방법은 한 계정으로 이어져요.
        <br />
        이메일이 다르면 새 계정이 만들어져요.
      </p>

      <nav
        aria-label="약관"
        style={{
          marginTop: 24,
          display: "flex",
          justifyContent: "center",
          gap: 16,
          fontSize: 13,
          color: "var(--sub)",
        }}
      >
        <Link href="/terms">이용약관</Link>
        <Link href="/privacy">개인정보처리방침</Link>
      </nav>

      <FeedbackLink />
    </main>
  );
}

// 로그인 뒤 돌아갈 주소를 그대로 넘긴다. 검사는 /auth/login과 /auth/callback이 한다.
async function NextField({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  if (typeof next !== "string") return null;
  return <input type="hidden" name="next" value={next} />;
}

async function ErrorNotice({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p
      role="alert"
      style={{
        marginTop: 16,
        fontSize: 14,
        color: "var(--danger)",
        textAlign: "center",
      }}
    >
      로그인하지 못했어요. 다시 시도해 주세요.
    </p>
  );
}
