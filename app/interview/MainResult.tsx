import type { ReactNode, RefObject } from "react";
import { Icon } from "@/components/icons";
import type { TurnResult } from "@/lib/server/turn";
import s from "./interview.module.css";
import { ScoreRing } from "./ScoreRing";
import { scoreVerdict } from "./verdict";
import { VerdictMark } from "./VerdictMark";

// 본 질문 채점 결과(docs/07): surface 면 하나에 점수 · 막대 · 판정 · 한 줄 평 · 잘한 점 · 보완할 점 · 보완할 개념,
// 그 아래 접힌 "모범 답안과 참고 자료" 한 줄. 면접 결과와 기록 상세가 같이 써서 두 화면이 어긋나지 않는다(#170).
// children은 점수 막대 바로 아래 줄(면접의 점수 변화 줄, #131)
export function MainResult({
  result,
  panelRef,
  children,
}: {
  result: TurnResult;
  panelRef?: RefObject<HTMLElement | null>;
  children?: ReactNode;
}) {
  const unknown = result.verdict === "unknown";
  // 모르겠어요는 0점으로 기록되지만 점수 대신 –와 빈 막대로 보여준다(홈·기록과 같다)
  const score = unknown ? undefined : (result.score ?? 0);
  const good = unknown ? [] : (result.feedback?.good ?? []);
  const improve = unknown ? [] : (result.feedback?.improve ?? []);
  return (
    <>
      <section
        ref={panelRef}
        tabIndex={panelRef ? -1 : undefined}
        className={s.panel}
        aria-label="채점 결과"
      >
        {/* 0에서 점수까지 차오르는 것은 ScoreRing이 맡는다 */}
        <ScoreRing
          shown={score ?? 0}
          label={score === undefined ? "점수 없음" : `100점 만점에 ${score}점`}
          value={score}
          empty="–"
          aside={
            <VerdictMark
              verdict={score === undefined ? "unknown" : scoreVerdict(score)}
            />
          }
        />
        {children}
        {!unknown && result.feedback?.summary && (
          <p className={s.summary}>{result.feedback.summary}</p>
        )}

        {/* 잘한 점을 먼저, 보완할 점을 다음에(DESIGN.md Voice). 위 1px 선 아래, 768 이상 2열 */}
        {(good.length > 0 || improve.length > 0) && (
          <div className={s.points}>
            {good.length > 0 && (
              <div className={s.block}>
                <h3 className={s.heading}>잘한 점</h3>
                <ul className={s.list}>
                  {good.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            {improve.length > 0 && (
              <div className={s.block}>
                <h3 className={s.heading}>보완할 점</h3>
                <ul className={s.list}>
                  {improve.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {result.missingKeywords.length > 0 && (
          <div className={s.block}>
            <h3 className={s.heading}>보완할 개념</h3>
            <div className={s.chips}>
              {/* 코드 식별자(한글이 없는 개념)는 모노(docs/07 라벨) */}
              {result.missingKeywords.map((k) => (
                <span
                  key={k}
                  className={`tag tag-concept ${/[가-힣]/.test(k) ? "" : "mono"}`}
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 모범 답안·참고 자료만 접어 둔다. 모르겠어요는 모범 답안이 전부라 펼친 채로 */}
      <details className={s.more} open={unknown}>
        <summary>
          모범 답안과 참고 자료
          <Icon name="chevronDown" size={18} />
        </summary>
        <div className={s.moreBody}>
          <div className={s.block}>
            <h3 className={s.heading}>모범 답안</h3>
            <p className={s.well}>{result.modelAnswer}</p>
          </div>

          {result.links.length > 0 && (
            <div className={s.block}>
              <h3 className={s.heading}>참고 자료</h3>
              <ul className={s.links}>
                {result.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </>
  );
}
