import type { ReactNode } from "react";
import s from "./landing.module.css";

// 실제 앱 화면 캡처(public/landing/<id>-<dark|light>.<avif|webp|png>). 다크·라이트 두 장을 두고
// 보이는 쪽은 CSS가 data-theme으로 고른다(landing.module.css "테마 쌍 이미지"). 숨은 쪽은 lazy라 받지 않는다.
// eager는 첫 화면 다크 한 벌에만 쓴다. from을 주면 그보다 좁은 화면에서는 빈 그림을 골라 받지 않는다
// (첫 화면 데스크톱 캡처는 휴대폰 폭에서 숨는데 eager라 숨어도 받기 때문)
const BLANK =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

export const PHONE = { w: 390, h: 844 };
export const DESK = { w: 1440, h: 900 };

export function Shot({
  id,
  w,
  h,
  alt,
  eager,
  from,
}: {
  id: string;
  w: number;
  h: number;
  alt: string;
  eager?: boolean;
  from?: number;
}) {
  return (["dark", "light"] as const).map((t) => {
    const first = eager && t === "dark";
    const src = `/landing/${id}-${t}`;
    return (
      <picture key={t} data-shot={t}>
        {from && <source media={`(max-width: ${from - 1}px)`} srcSet={BLANK} />}
        <source type="image/avif" srcSet={`${src}.avif`} />
        <source type="image/webp" srcSet={`${src}.webp`} />
        {/* 정적 캡처 묶음이라 next/image 대신 <picture>로 형식을 고른다 */}
        <img
          src={`${src}.png`}
          width={w}
          height={h}
          alt={alt}
          loading={first ? "eager" : "lazy"}
          fetchPriority={first ? "high" : undefined}
          decoding={first ? undefined : "async"}
        />
      </picture>
    );
  });
}

// 기기 틀(랜딩 로컬 확장 device-frame, .omd/decisions.md landing-showcase). 크기는 className의 width로만 정하고
// 베젤·모서리는 틀 폭에 비례한다. 그림자는 앞에 놓인 틀(front) 하나에만
export function Phone({
  children,
  className = "",
  front,
}: {
  children: ReactNode;
  className?: string;
  front?: boolean;
}) {
  return (
    <div className={`${s.phone} ${className}`}>
      <div className={`${s.phoneBody} ${front ? s.front : ""}`}>
        <div className={s.screen}>{children}</div>
      </div>
    </div>
  );
}

export function Desktop({
  children,
  route,
  className = "",
}: {
  children: ReactNode;
  route: string;
  className?: string;
}) {
  return (
    <div className={`${s.desktop} ${className}`}>
      <div className={s.deskBody}>
        <div className={s.bar} aria-hidden="true">
          {route}
        </div>
        <div className={s.screen}>{children}</div>
      </div>
    </div>
  );
}
