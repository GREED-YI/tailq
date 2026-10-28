import Image from "next/image";

// AI 면접관 3D Q. 본체는 천천히 부유하고, 채점 중(thinking)에는 맥박친다.
// 처음엔 뒤에 민트 후광(radial-gradient)을 깔았는데, 새 디자인(DESIGN.md)은 장식 그라디언트를 쓰지 않아 걷어 냈다.
// 면접 화면은 마스코트 없이 서도록 이 Q를 쓰지 않는다(채점 중은 제출 버튼 진행 표시와 점수 자리 표시가 맡는다, 2026-10-28).
// 반사·접지 그림자는 어색해서 쓰지 않는다(2026-10-26).
export function FloatingQ({
  size = 136,
  thinking = false,
}: {
  size?: number;
  thinking?: boolean;
}) {
  return (
    <div aria-hidden="true" style={{ width: size, height: size }}>
      <div className={thinking ? "think" : "float"}>
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
