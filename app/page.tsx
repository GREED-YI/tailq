import Link from "next/link";
import { FeedbackLink } from "@/components/FeedbackLink";
import { FloatingQ } from "@/components/FloatingQ";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

// 랜딩 자리. 실제 랜딩은 #40에서 만든다.
export default function Home() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "0 20px",
        maxWidth: 640,
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
      <section
        style={{
          marginTop: 48,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          textAlign: "center",
        }}
      >
        <FloatingQ size={160} />
        <h1 style={{ fontSize: 32, lineHeight: "40px", fontWeight: 700 }}>
          TailQ
        </h1>
        <p style={{ color: "var(--sub)" }}>
          매일 기술면접 질문 하나. AI가 채점하고 꼬리질문을 던져요.
        </p>
        <Link href="/home" className="btn btn-primary press">
          홈 미리 보기
        </Link>
      </section>
      <FeedbackLink />
    </main>
  );
}
