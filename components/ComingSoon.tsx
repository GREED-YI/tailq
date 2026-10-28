import s from "./AppShell.module.css";

// 아직 만들지 않은 탭 화면. 탭이 404로 가지 않게 둔다.
export function ComingSoon({ title, issue }: { title: string; issue: number }) {
  return (
    <>
      <h1 className={s.headerTitle}>{title}</h1>
      <p style={{ marginTop: 8, fontSize: 15, color: "var(--text-sub)" }}>
        준비하고 있어요 (#{issue})
      </p>
    </>
  );
}
