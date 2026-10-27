import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { TailIcon } from "@/components/Streak";
import {
  grassCells,
  grassRange,
  type GrassCell,
  type GrassView,
} from "@/lib/streak";
import { loadStudy } from "@/lib/study";
import { weaknessReport, type TopicScore } from "@/lib/weakness";
import { GrassTip } from "@/components/GrassTip";
import h from "../history/history.module.css";
import w from "./report.module.css";

export const metadata: Metadata = { title: "리포트 · TailQ" };

// 꼬리잇기 달력 보기. 처음엔 최근 1년 잔디 하나였으나 칸이 작고 빽빽해, 기본 3개월에 주·월·1년을 고르게 했다(#117)
const VIEWS: { key: GrassView; label: string; range: string }[] = [
  { key: "week", label: "주", range: "이번 주" },
  { key: "month", label: "월", range: "이번 달" },
  { key: "3m", label: "3개월", range: "최근 3개월" },
  { key: "year", label: "1년", range: "최근 1년" },
];

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

// 리포트(04 기능 명세 E-2·E-3, S21): 꼬리잇기·최장, 꼬리잇기 달력, 약점 리포트.
// 처음엔 기록 탭 안("기록 / 리포트")에 있었으나 별도 화면으로 옮겼다(#117). ?view로 달력 보기를 고른다
export default function ReportPage({ searchParams }: PageProps<"/report">) {
  return (
    <div className={w.page}>
      <AppHeader title="리포트" />
      <h1 className={h.pageTitle}>리포트</h1>
      <Suspense>
        {searchParams.then((p) => (
          <Report view={VIEWS.find((v) => v.key === p.view)?.key ?? "3m"} />
        ))}
      </Suspense>
    </div>
  );
}

async function Report({ view }: { view: GrassView }) {
  const { today, scores, streak, attempts } = await loadStudy();
  const weak = weaknessReport(attempts, today);
  const cells = grassCells(
    scores,
    streak.restDays,
    today,
    grassRange(view, today),
  );
  // 월 보기의 앞뒤 주에 걸친 다른 달 날은 비워 둔다
  const out = (c: GrassCell) =>
    view === "month" && c.day.slice(0, 7) !== today.slice(0, 7);
  const studied = cells.filter((c) => c.level > 0 && !out(c)).length;
  const rested = cells.filter((c) => c.rest && !out(c)).length;
  const range = VIEWS.find((v) => v.key === view)!.range;
  const calendar = view === "week" || view === "month";

  const grid = (
    <GrassTip
      className={`${w.grass} ${calendar ? w.calendar : w.strip}`}
      label={`${range} ${studied}일 학습, 휴식권 ${rested}번 사용`}
    >
      {cells.map((c) => (
        <span
          key={c.day}
          data-tip={c.future || out(c) ? undefined : cellTitle(c, today)}
          data-level={c.level}
          data-rest={c.rest || undefined}
          data-future={c.future || undefined}
          data-out={out(c) || undefined}
          data-today={c.day === today || undefined}
        >
          {/* 주·월 보기는 칸 안에 날짜 */}
          {calendar && !out(c) && Number(c.day.slice(8))}
        </span>
      ))}
    </GrassTip>
  );

  return (
    <>
      <section className={w.stats} aria-label="꼬리잇기">
        <div className={`glass ${w.stat}`}>
          <span>꼬리잇기</span>
          <strong>
            <span className={`mono ${w.value} ${w.accent}`}>
              {streak.current}
            </span>
            {streak.current > 0 ? " 일째" : " 일"}
          </strong>
        </div>
        <div className={`glass ${w.stat}`}>
          <span>최장</span>
          <strong>
            <span className={`mono ${w.value}`}>{streak.longest}</span> 일
          </strong>
        </div>
      </section>

      <section aria-labelledby="grass-head">
        <div className={w.head}>
          {/* 처음엔 "학습 잔디"였으나 꼬리잇기와 이어지게 "꼬리잇기 달력"으로 바꿨다(#117) */}
          <h2 id="grass-head" className={w.grassTitle}>
            <TailIcon size={18} />
            꼬리잇기 달력
          </h2>
          <span className="num">
            {range} · {studied}일 학습
          </span>
        </div>
        <div className={`glass ${w.grassCard}`}>
          <nav className={w.seg} aria-label="달력 보기">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                href={v.key === "3m" ? "/report" : `/report?view=${v.key}`}
                replace
                scroll={false}
                className="press"
                aria-current={v.key === view ? "page" : undefined}
              >
                {v.label}
              </Link>
            ))}
          </nav>
          {calendar ? (
            <div className={w.calendarWrap}>
              <div className={w.weekdays} aria-hidden="true">
                {WEEKDAYS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              {grid}
            </div>
          ) : (
            <div
              className={`${w.grassScroll} ${view === "year" ? w.yearScroll : ""}`}
            >
              <div
                className={`${w.stripWrap} ${view === "year" ? w.year : w.quarter}`}
              >
                <MonthLabels cells={cells} />
                {grid}
              </div>
            </div>
          )}
          <p className={w.caption}>
            진할수록 점수가 높고, 빗금은 휴식권을 쓴 날이에요
          </p>
        </div>
      </section>

      <section aria-labelledby="weak-head">
        <div className={w.head}>
          <h2 id="weak-head">약점 리포트</h2>
          <span>3번 이상 푼 주제만 보여줘요</span>
        </div>
        <div className={`glass ${w.weakCard}`}>
          {weak.topics.length > 0 && (
            <ul className={w.list}>
              {weak.topics.map((t) => (
                <TopicRow key={t.topicId} t={t} />
              ))}
            </ul>
          )}
          {weak.topics.length === 0 ? (
            <p className={w.caption}>
              데이터가 모이는 중이에요. 한 주제를 3번 이상 풀면 평균 점수와
              추이를 보여드려요.
            </p>
          ) : (
            weak.collecting > 0 && (
              <p className={w.caption}>
                그 밖의 {weak.collecting}개 주제는 데이터가 모이는 중이에요
              </p>
            )
          )}
        </div>
      </section>
    </>
  );
}

// 3개월·1년 보기 위 달 이름: 월요일이 새 달로 넘어간 첫 주 열에만 "N월"(첫 열과 끝 열이 잘리지 않게)
function MonthLabels({ cells }: { cells: GrassCell[] }) {
  const mondays = cells.filter((_, i) => i % 7 === 0).map((c) => c.day);
  return (
    <div className={w.months} aria-hidden="true">
      {mondays.map((d, i) => (
        <span key={d}>
          {i > 0 &&
            d.slice(5, 7) !== mondays[i - 1].slice(5, 7) &&
            `${Number(d.slice(5, 7))}월`}
        </span>
      ))}
    </div>
  );
}

// 왼쪽 평균 점수·주제 이름, 오른쪽 지난주 대비 변화(S21)
function TopicRow({ t }: { t: TopicScore }) {
  return (
    <li className={w.row}>
      <span className={w.left}>
        <span className="num">평균 {t.average}점</span>
        <strong>{t.topic}</strong>
      </span>
      <span className={w.right}>
        <span>{t.change == null ? "지난주 기록 없음" : "지난주 대비"}</span>
        {t.change != null && (
          <strong className="num" data-trend={trend(t.change)}>
            {changeText(t.change)}
          </strong>
        )}
      </span>
    </li>
  );
}

const trend = (c: number) => (c === 0 ? undefined : c > 0 ? "up" : "down");

const changeText = (c: number) =>
  c === 0 ? "– 같음" : `${c > 0 ? "▲" : "▼"} ${Math.abs(c)}점`;

// 칸마다 날짜·점수 말풍선(docs/07 "학습 잔디"). 홈 이번 주 칸과 같은 문구:
// 학습하지 않은 날은 "기록 없음", 아직 안 푼 오늘은 "오늘"
function cellTitle(c: GrassCell, today: string) {
  const day = c.day.replaceAll("-", ".");
  if (c.rest) return `${day} · 휴식권`;
  if (c.level === 0)
    return `${day} · ${c.day === today ? "오늘" : "기록 없음"}`;
  return c.score == null ? `${day} · 학습` : `${day} · ${c.score}점`;
}
