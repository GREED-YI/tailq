import s from "./Streak.module.css";

// 여우 꼬리 아이콘(Figma C안 Icon/fox-tail). 채움색은 글자색을 따른다
export function TailIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2 16C6 12 11 10.5 15.2 11.6C15.7 13.5 15.2 15.8 13.8 17.4C9.5 18.6 5 18.2 2 16Z" />
      <path d="M16.6 11.9C18.5 12.5 20.5 11 22 8.5C21.8 13 19 16.5 15.2 17.2C16.6 15.6 17 13.6 16.6 11.9Z" />
    </svg>
  );
}

// "꼬리잇기 12일째"(docs/07 "꼬리잇기"). 숫자는 Geist Mono
function StreakDays({ days }: { days: number }) {
  return (
    <>
      <span className={`mono ${s.days}`}>{days}</span>
      {days > 0 ? "일째" : "일"}
    </>
  );
}

// 오늘의 결과의 꼬리잇기 칸
export function StreakTile({ days, note }: { days: number; note?: string }) {
  return (
    <div className={s.tile}>
      <span className={s.label}>
        <TailIcon />
        꼬리잇기
      </span>
      <strong className={s.value}>
        <StreakDays days={days} />
      </strong>
      {note && <span className={s.note}>{note}</span>}
    </div>
  );
}
