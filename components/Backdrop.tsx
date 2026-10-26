// 화면 뒤에 깔리는 배경 빛 덩어리 3개. 유리가 보이려면 뒤에 빛이 있어야 한다(docs/07).
// 크기와 위치는 Figma C안 배경(모바일 300·260·220, PC 720·624·528)의 비율을 따른다.
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div
        className="blob"
        style={{
          width: "min(77vw, 720px)",
          aspectRatio: "1",
          left: "calc(min(77vw, 720px) * -0.4)",
          top: "calc(min(77vw, 720px) * -0.27)",
          background: "var(--blob1)",
        }}
      />
      <div
        className="blob"
        style={{
          width: "min(67vw, 624px)",
          aspectRatio: "1",
          right: "calc(min(67vw, 624px) * -0.42)",
          top: "36%",
          background: "var(--blob2)",
        }}
      />
      <div
        className="blob"
        style={{
          width: "min(56vw, 528px)",
          aspectRatio: "1",
          left: "10%",
          bottom: "calc(min(56vw, 528px) * -0.41)",
          background: "var(--blob3)",
        }}
      />
    </div>
  );
}
