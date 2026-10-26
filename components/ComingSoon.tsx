import { AppHeader } from "./AppHeader";

// 아직 만들지 않은 탭 화면. 탭이 404로 가지 않게 둔다.
export function ComingSoon({ title, issue }: { title: string; issue: number }) {
  return (
    <>
      <AppHeader />
      <h1
        style={{
          marginTop: 8,
          fontSize: 26,
          lineHeight: "34px",
          fontWeight: 700,
          letterSpacing: -0.6,
        }}
      >
        {title}
      </h1>
      <p style={{ marginTop: 8, fontSize: 14, color: "var(--sub)" }}>
        준비하고 있어요 (#{issue})
      </p>
    </>
  );
}
