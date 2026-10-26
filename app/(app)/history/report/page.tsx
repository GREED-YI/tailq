import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { StreakDays, TailIcon } from "@/components/Streak";
import { grassCells, type GrassCell } from "@/lib/streak";
import { loadStudy } from "@/lib/study";
import s from "../history.module.css";
import { HistoryTabs } from "../HistoryTabs";

export const metadata: Metadata = { title: "리포트 · TailQ" };

// 리포트(04 기능 명세 E-2, S21): 꼬리잇기와 최근 1년 학습 잔디. 약점 리포트는 그 이슈(#38)에서 붙인다
export default function ReportPage() {
  return (
    <>
      <AppHeader />
      <h1 className={s.title}>기록</h1>
      <HistoryTabs current="report" />
      <Suspense>
        <Report />
      </Suspense>
    </>
  );
}

async function Report() {
  const { today, scores, streak } = await loadStudy();
  const cells = grassCells(scores, streak.restDays, today);
  const studied = cells.filter((c) => c.level > 0).length;

  return (
    <>
      <section className={`glass ${s.report}`} aria-label="꼬리잇기">
        <h2 className={s.reportHead}>
          <TailIcon size={18} />
          <span>
            꼬리잇기 <StreakDays days={streak.current} />
          </span>
          <span className={`num ${s.sub}`}>· 최장 {streak.longest}일</span>
        </h2>
        <p className={s.caption}>
          하루도 빠지지 않고 이어서 푼 날 수예요. 일주일에 한 번은 쉬어도
          휴식권으로 이어져요.
        </p>
      </section>

      <section className={`glass ${s.report}`} aria-label="학습 잔디">
        <h2 className={s.reportHead}>
          학습 잔디
          <span className={`num ${s.sub}`}>· 최근 1년 · {studied}일 학습</span>
        </h2>
        <div className={s.grassScroll}>
          <div
            className={s.grass}
            role="img"
            aria-label={`최근 1년 동안 ${studied}일 학습, 휴식권 ${streak.restDays.length}번 사용`}
          >
            {cells.map((c) => (
              <span
                key={c.day}
                title={cellTitle(c)}
                data-level={c.level}
                data-rest={c.rest || undefined}
                data-future={c.future || undefined}
              />
            ))}
          </div>
        </div>
        <p className={s.caption}>
          진할수록 점수가 높고, 빗금은 휴식권을 쓴 날이에요
        </p>
      </section>
    </>
  );
}

// 칸마다 날짜·점수 툴팁(docs/07 "학습 잔디")
function cellTitle(c: GrassCell) {
  const day = c.day.replaceAll("-", ".");
  if (c.rest) return `${day} · 휴식권`;
  if (c.level === 0) return day;
  return c.score == null ? `${day} · 학습` : `${day} · ${c.score}점`;
}
