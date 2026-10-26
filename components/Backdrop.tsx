// 화면 뒤에 깔리는 배경 빛 덩어리 3개. 유리가 보이려면 뒤에 빛이 있어야 한다(docs/07).
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div
        className="blob"
        style={{
          width: "min(80vw, 720px)",
          aspectRatio: "1",
          left: "-12%",
          top: "-10%",
          background: "var(--blob1)",
        }}
      />
      <div
        className="blob"
        style={{
          width: "min(70vw, 620px)",
          aspectRatio: "1",
          right: "-14%",
          top: "36%",
          background: "var(--blob2)",
        }}
      />
      <div
        className="blob"
        style={{
          width: "min(56vw, 520px)",
          aspectRatio: "1",
          left: "10%",
          bottom: "-14%",
          background: "var(--blob3)",
        }}
      />
    </div>
  );
}
