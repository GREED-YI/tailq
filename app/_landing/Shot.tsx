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

// 기기 틀(랜딩 로컬 확장 device-frame, .omd/decisions.md landing-showcase). 실제 기기처럼 보이게 CSS로만 그린다
// (제조사 이미지·로고·제품명 없음). 크기는 className의 width로만 정하고 나머지는 틀 폭(cqi)에 비례한다.
// 휴대폰: 금속 테두리 · 검정 베젤 · 상태 표시줄과 가운데 알약 · 옆 버튼. 캡처는 상태 표시줄 아래에 잘림 없이 들어간다
export function Phone({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${s.phone} ${className}`}>
      <div className={s.phoneBody}>
        {KEYS.map((k) => (
          <span key={k} className={s.key} data-k={k} aria-hidden="true" />
        ))}
        <div className={s.bezel}>
          <div className={s.screen}>
            <div className={s.status} aria-hidden="true">
              <span>9:41</span>
              <span className={s.island} />
              <StatusIcons />
            </div>
            <div className={s.shots}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
const KEYS = ["action", "up", "down", "power", "camera"];

// 노트북: 얇은 검정 베젤 · 위 가운데 카메라 노치 · 알루미늄 하판(손톱 홈). 화면 위에는 창 버튼 3점과 주소창만
export function Desktop({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${s.desktop} ${className}`}>
      <div className={s.lid}>
        <span className={s.notch} aria-hidden="true" />
        <div className={s.screen}>
          <div className={s.chrome} aria-hidden="true">
            <i />
            <i />
            <i />
            <span className={s.addr}>TailQ</span>
          </div>
          <div className={s.shots}>{children}</div>
        </div>
      </div>
      <div className={s.base} aria-hidden="true">
        <span className={s.lip} />
      </div>
    </div>
  );
}

// 상태 표시줄 오른쪽: 신호 · 와이파이 · 배터리
function StatusIcons() {
  return (
    <svg viewBox="0 0 68 12" fill="currentColor">
      <rect x="0" y="8" width="3" height="4" rx="0.8" />
      <rect x="4.5" y="6" width="3" height="6" rx="0.8" />
      <rect x="9" y="3.5" width="3" height="8.5" rx="0.8" />
      <rect x="13.5" y="1" width="3" height="11" rx="0.8" />
      <path d="M30 2.2a10 10 0 0 1 7.3 3.1l1.3-1.3A11.8 11.8 0 0 0 30 .4a11.8 11.8 0 0 0-8.6 3.6l1.3 1.3A10 10 0 0 1 30 2.2Zm0 3.7a6.2 6.2 0 0 1 4.6 2l1.3-1.3a8 8 0 0 0-11.8 0l1.3 1.3a6.2 6.2 0 0 1 4.6-2Zm0 3.7a2.5 2.5 0 0 1 1.9.8L30 12.3l-1.9-1.9a2.5 2.5 0 0 1 1.9-.8Z" />
      <rect
        x="42.5"
        y="0.5"
        width="22"
        height="11"
        rx="3.2"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.4"
      />
      <rect x="44.5" y="2.5" width="18" height="7" rx="1.8" />
      <path d="M66 4v4a2 2 0 0 0 0-4Z" fillOpacity="0.4" />
    </svg>
  );
}
