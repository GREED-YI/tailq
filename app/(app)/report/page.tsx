import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { TailIcon } from "@/components/Streak";
import { kstDay } from "@/lib/daily-pick";
import {
  grassCells,
  grassStart,
  weekStart,
  type GrassCell,
} from "@/lib/streak";
import { loadStudy } from "@/lib/study";
import { createClient } from "@/lib/supabase/server";
import { weaknessReport, type TopicScore } from "@/lib/weakness";
import { GrassTip } from "@/components/GrassTip";
import { ScoreBar } from "@/app/interview/ScoreRing";
import { Score } from "../history/marks";
import h from "../history/history.module.css";
import w from "./report.module.css";

export const metadata: Metadata = { title: "리포트 · TailQ" };

// 리포트(04 기능 명세 E-2·E-3, S21): 꼬리잇기·최장, 꼬리잇기 달력, 약점 리포트.
// 처음엔 기록 탭 안("기록 / 리포트")에 있었으나 별도 화면으로 옮겼다(#117)
export default function ReportPage() {
  return (
    <div className={w.page}>
      <AppHeader title="리포트" />
      <h1 className={h.pageTitle}>리포트</h1>
      <Suspense>
        <Report />
      </Suspense>
    </div>
  );
}

// 꼬리잇기 달력은 1년(52주) 고정이고, 사용자가 시작한 주부터 채운다. 처음엔 주·월·3개월·1년 보기를 골랐으나
// (?view) 시작한 날부터 채워지는 느낌이 나게 1년 하나로 고정했다(#117). 옛 ?view 링크는 무시한다
async function Report() {
  const supabase = await createClient();
  const [{ today, scores, streak, attempts }, { data: profile }] =
    await Promise.all([
      loadStudy(),
      supabase.from("profiles").select("created_at").maybeSingle(),
    ]);
  const weak = weaknessReport(attempts, today);
  // 시작한 날: 가입일의 한국 날짜. 가입 전에 푼 체험을 이어받았으면 그 첫 학습일이 더 이르다
  const joined = [
    profile && kstDay(new Date(profile.created_at)),
    ...scores.keys(),
  ]
    .filter((d): d is string => !!d)
    .sort()[0];
  const cells = grassCells(
    scores,
    streak.restDays,
    today,
    grassStart(today, joined),
  );
  // 시작한 날 앞(첫 주의 그 전 요일)은 비워 둔다
  const before = (c: GrassCell) => !!joined && c.day < joined;
  const studied = cells.filter((c) => c.level > 0).length;
  const rested = cells.filter((c) => c.rest).length;
  // 오늘이 든 열(0부터)과 시작한 지 몇 주째인지. 1년이 넘으면 달력은 최근 52주만 보여준다
  const todayCol = Math.floor(cells.findIndex((c) => c.day === today) / 7);
  const weeks = joined
    ? (Date.parse(weekStart(today)) - Date.parse(weekStart(joined))) /
        (7 * 86_400_000) +
      1
    : todayCol + 1;
  const range = weeks > 52 ? "최근 1년" : `시작한 지 ${weeks}주째`;
  // 처음 열릴 때 학습한 칸이 왼쪽부터 차오르게: 오늘 열까지를 0.45초에 나눠 늦게 나타난다
  const delay = (i: number) =>
    ({
      "--delay": `${Math.round((Math.floor(i / 7) / Math.max(todayCol, 1)) * 450)}ms`,
    }) as CSSProperties;

  const grid = (
    <GrassTip
      className={`${w.grass} ${w.strip}`}
      label={`꼬리잇기 달력 52주, ${range} ${studied}일 학습, 휴식권 ${rested}번 사용`}
    >
      {cells.map((c, i) => (
        <span
          key={c.day}
          data-tip={c.future || before(c) ? undefined : cellTitle(c, today)}
          data-level={c.level}
          data-rest={c.rest || undefined}
          data-future={c.future || undefined}
          data-out={before(c) || undefined}
          data-today={c.day === today || undefined}
          style={c.level > 0 || c.rest ? delay(i) : undefined}
        />
      ))}
    </GrassTip>
  );

  return (
    <>
      {/* 숫자 타일(stat-tiles): 1px 선으로 나뉜 한 묶음 */}
      <section className={w.stats} aria-label="꼬리잇기">
        <div className={w.stat}>
          <span>꼬리잇기</span>
          <p>
            <b className="mono">{streak.current}</b>
            {streak.current > 0 ? "일째" : "일"}
          </p>
        </div>
        <div className={w.stat}>
          <span>최장</span>
          <p>
            <b className="mono">{streak.longest}</b>일
          </p>
        </div>
      </section>

      <section className={w.section} aria-labelledby="grass-head">
        <div className={h.listHead}>
          {/* 처음엔 "학습 잔디"였으나 꼬리잇기와 이어지게 "꼬리잇기 달력"으로 바꿨다(#117) */}
          <h2 id="grass-head" className={w.grassTitle}>
            <TailIcon size={18} />
            꼬리잇기 달력
          </h2>
          <span className={`num ${w.headNote}`}>
            {range} · {studied}일 학습
          </span>
        </div>
        <div className={w.grassScroll}>
          <div className={w.stripWrap}>
            <MonthLabels cells={cells} joined={joined} />
            {grid}
          </div>
        </div>
        <p className={w.caption}>
          진할수록 점수가 높고, 빗금은 휴식권을 쓴 날이에요
        </p>
      </section>

      <section className={w.section} aria-labelledby="weak-head">
        <div className={h.listHead}>
          <h2 id="weak-head">약점 리포트</h2>
          <span className={w.headNote}>3번 이상 푼 주제만 보여줘요</span>
        </div>
        {weak.topics.length > 0 && (
          <ul className={`${h.list} ${w.list}`}>
            {weak.topics.map((t) => (
              <TopicRow key={t.topicId} t={t} />
            ))}
          </ul>
        )}
        {weak.topics.length === 0 ? (
          <p className={h.rowEmpty}>
            데이터가 모이고 있어요. 한 주제를 3번 이상 풀면 평균 점수와 추이를
            보여 줄게요.
          </p>
        ) : (
          weak.collecting > 0 && (
            <p className={w.caption}>
              그 밖의 {weak.collecting}개 주제는 데이터가 모이는 중이에요
            </p>
          )
        )}
      </section>
    </>
  );
}

// 달력 위 달 이름: 첫 열은 실제 시작한 날(시작 전 날은 비어 있다)의 달, 그 뒤로는 그 달 1일이 든 열에 "N월".
// 끝 열은 글자가 밖으로 넘쳐 뺀다
function MonthLabels({
  cells,
  joined,
}: {
  cells: GrassCell[];
  joined?: string;
}) {
  const cols = Array.from({ length: Math.ceil(cells.length / 7) }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7).filter((c) => !joined || c.day >= joined),
  );
  const label = (col: GrassCell[], i: number) => {
    if (col.length === 0 || i === cols.length - 1) return null;
    if (i === 0) return col[0].day.slice(5, 7);
    const first = col.find((c) => c.day.slice(8) === "01");
    return first ? first.day.slice(5, 7) : null;
  };
  return (
    <div className={w.months} aria-hidden="true">
      {cols.map((col, i) => {
        const m = label(col, i);
        return <span key={i}>{m && `${Number(m)}월`}</span>;
      })}
    </div>
  );
}

// 주제 이름 · 평균 점수와 20칸 막대 · 지난주 대비 변화(S21). 오르면 text, 내리면 danger(색과 ▲▼를 같이 쓴다).
// 변화가 없거나 지난주 기록이 없으면 오른쪽 칸을 그리지 않는다(R13)
function TopicRow({ t }: { t: TopicScore }) {
  return (
    <li className={w.row}>
      <span className={w.left}>
        <strong>{t.topic}</strong>
        <span className={w.avg}>
          평균
          <Score value={t.average} />
        </span>
        <ScoreBar value={t.average} small />
      </span>
      {t.change != null && t.change !== 0 && (
        <span className={w.right}>
          <span>지난주 대비</span>
          <strong className="num" data-trend={t.change > 0 ? "up" : "down"}>
            {`${t.change > 0 ? "▲" : "▼"} ${Math.abs(t.change)}점`}
          </strong>
        </span>
      )}
    </li>
  );
}

// 칸마다 날짜·점수 말풍선(docs/07 "학습 잔디"). 홈 이번 주 칸과 같은 문구:
// 학습하지 않은 날은 "기록 없음", 아직 안 푼 오늘은 "오늘"
function cellTitle(c: GrassCell, today: string) {
  const day = c.day.replaceAll("-", ".");
  if (c.rest) return `${day} · 휴식권`;
  if (c.level === 0)
    return `${day} · ${c.day === today ? "오늘" : "기록 없음"}`;
  return c.score == null ? `${day} · 학습` : `${day} · ${c.score}점`;
}
