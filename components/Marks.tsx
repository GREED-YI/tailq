import { VerdictMark } from "@/app/interview/VerdictMark";
import { scoreVerdict } from "@/app/interview/verdict";
import s from "./Marks.module.css";

// 목록·타일의 점수 숫자(DESIGN.md score inline). 점수 구간을 판정 모양 점으로 함께 보여 색만으로 말하지 않는다
// (높음 채운 원 · 중간 반쪽 원 · 낮음 네모). 점수가 없으면(모르겠어요) –. 홈·기록·리포트가 같이 쓴다
export function Score({ value }: { value: number | null }) {
  if (value === null) return <span className={`mono ${s.score}`}>–</span>;
  return (
    <VerdictMark verdict={scoreVerdict(value)} className={`mono ${s.score}`}>
      {value}
    </VerdictMark>
  );
}

// 숙련도 5칸: 채운 칸 text, 빈 칸 mark-empty 테두리
export function Dots({ level }: { level: number }) {
  return (
    <span className={s.dots} role="img" aria-label={`숙련도 5칸 중 ${level}칸`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} data-on={n <= level || undefined} />
      ))}
    </span>
  );
}
