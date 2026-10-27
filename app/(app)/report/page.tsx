import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { grassCells, type GrassCell } from "@/lib/streak";
import { loadStudy } from "@/lib/study";
import { weaknessReport, type TopicScore } from "@/lib/weakness";
import s from "../history.module.css";
import { HistoryTabs } from "../HistoryTabs";
import { GrassTip } from "./GrassTip";
import w from "./weakness.module.css";

export const metadata: Metadata = { title: "리포트 · TailQ" };

// 리포트(04 기능 명세 E-2·E-3, S21): 꼬리잇기·최장, 최근 1년 학습 잔디, 약점 리포트
export default function ReportPage() {
  return (
    <div className={s.page}>
      <AppHeader title="기록" />
      <h1 className={s.pageTitle}>기록</h1>
      <div className={s.bar}>
        <HistoryTabs current="report" />
      </div>
      <Suspense>
        <Report />
      </Suspense>
    </div>
  );
}

async function Report() {
  const { today, scores, streak, attempts } = await loadStudy();
  const weak = weaknessReport(attempts, today);
  const cells = grassCells(scores, streak.restDays, today);
  const studied = cells.filter((c) => c.level > 0).length;

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
          <h2 id="grass-head">학습 잔디</h2>
          <span className="num">최근 1년 · {studied}일 학습</span>
        </div>
        <div className={`glass ${w.grassCard}`}>
          <div className={s.grassScroll}>
            <GrassTip
              className={s.grass}
              label={`최근 1년 동안 ${studied}일 학습, 휴식권 ${streak.restDays.length}번 사용`}
            >
              {cells.map((c) => (
                <span
                  key={c.day}
                  data-tip={c.future ? undefined : cellTitle(c)}
                  data-level={c.level}
                  data-rest={c.rest || undefined}
                  data-future={c.future || undefined}
                />
              ))}
            </GrassTip>
          </div>
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

// 칸마다 날짜·점수 툴팁(docs/07 "학습 잔디")
function cellTitle(c: GrassCell) {
  const day = c.day.replaceAll("-", ".");
  if (c.rest) return `${day} · 휴식권`;
  if (c.level === 0) return day;
  return c.score == null ? `${day} · 학습` : `${day} · ${c.score}점`;
}
