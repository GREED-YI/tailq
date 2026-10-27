import { AppHeader } from "./AppHeader";

// 아직 만들지 않은 탭 화면. 탭이 404로 가지 않게 둔다.
export function ComingSoon({ title, issue }: { title: string; issue: number }) {
  return (
    <>
      <AppHeader />
      <h1
        style={{
          marginTop: 8,
          fontSize: 22,
          lineHeight: 1.35,
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h1>
      <p style={{ marginTop: 8, fontSize: 15, color: "var(--text-sub)" }}>
        준비하고 있어요 (#{issue})
      </p>
    </>
  );
}
