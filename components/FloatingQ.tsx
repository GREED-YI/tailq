import Image from "next/image";

// AI 면접관 3D Q. 뒤에 민트 후광(숨쉬기), 본체는 천천히 부유한다.
// 채점 중(thinking)에는 후광이 1.8초로 조금 빠르게 맥박친다(docs/07 "서비스 고유 요소").
// 반사·접지 그림자는 어색해서 쓰지 않는다(2026-10-26).
export function FloatingQ({
  size = 136,
  thinking = false,
}: {
  size?: number;
  thinking?: boolean;
}) {
  const halo = Math.round(size * 1.25);
  return (
    <div
      aria-hidden="true"
      style={{ position: "relative", width: size, height: size }}
    >
      <div
        className={thinking ? "think" : "breathe"}
        style={{
          position: "absolute",
          left: (size - halo) / 2,
          top: (size - halo) / 2,
          width: halo,
          height: halo,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, var(--halo) 0%, transparent 68%)",
        }}
      />
      <div className="float" style={{ position: "relative" }}>
        {/* 이미지는 원본 배경을 가장자리만 흐려 담고 있어 블렌드로 지운다(다크 screen, 라이트 multiply) */}
        <Image
          className="only-dark"
          src="/brand/q-dark.png"
          alt=""
          width={size}
          height={size}
          priority
          style={{ mixBlendMode: "screen" }}
        />
        <Image
          className="only-light"
          src="/brand/q-light.png"
          alt=""
          width={size}
          height={size}
          priority
          style={{ mixBlendMode: "multiply" }}
        />
      </div>
    </div>
  );
}
