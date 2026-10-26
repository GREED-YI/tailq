import { AppHeader } from "@/components/AppHeader";
import { FloatingQ } from "@/components/FloatingQ";

// 홈 뼈대. 오늘의 질문은 #30에서 채운다.
export default function HomePage() {
  return (
    <>
      <AppHeader />
      <h1
        style={{
          marginTop: 8,
          fontSize: 28,
          lineHeight: "36px",
          fontWeight: 700,
          letterSpacing: -0.8,
        }}
      >
        오늘도 한 문제
        <br />
        도전해 볼까요?
      </h1>
      <section
        className="glass"
        aria-label="오늘의 질문"
        style={{
          marginTop: 20,
          borderRadius: 32,
          padding: "22px 20px 20px",
          minHeight: 320,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", right: 14, top: 16 }}>
          <FloatingQ />
        </div>
        <div style={{ flex: 1 }} />
        <p style={{ fontSize: 15, color: "var(--sub)", position: "relative" }}>
          오늘의 질문을 준비하고 있어요
        </p>
        <button
          type="button"
          className="btn"
          disabled
          style={{ marginTop: 20, width: "100%" }}
        >
          시작하기
        </button>
      </section>
    </>
  );
}
