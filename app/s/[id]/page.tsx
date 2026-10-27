import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ScoreRing } from "@/app/interview/ScoreRing";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { kstDay } from "@/lib/daily-pick";
import { shareDate, shareName, shareSentence } from "@/lib/share";
import { loadShare } from "./load";
import s from "./share.module.css";

// 메신저 미리보기의 제목·설명. 이미지는 같은 폴더의 opengraph-image가 붙인다
export async function generateMetadata({
  params,
}: PageProps<"/s/[id]">): Promise<Metadata> {
  const card = await loadShare((await params).id);
  if (!card) return { title: "TailQ" };
  const title = `${card.nickname ? `${card.nickname}님의 ` : ""}TailQ 결과 · ${card.topic_name} ${card.score}점`;
  const description = "매일 기술면접 질문 하나. 나도 한 문제 풀어보기";
  return { title, description, openGraph: { title, description } };
}

// 공유 페이지(04 기능 명세 8번, Figma S04). 로그인 없이 누구나 연다.
// 카드(닉네임·주제·점수·꼬리잇기)와 "나도 풀어보기"만 둔다. 질문 원문·답변은 없다.
export default function SharePage({ params }: PageProps<"/s/[id]">) {
  return (
    <Suspense>
      {params.then((p) => (
        <ShareView id={p.id} />
      ))}
    </Suspense>
  );
}

async function ShareView({ id }: { id: string }) {
  const card = await loadShare(id);
  // 없는 카드(탈퇴로 지워진 카드 포함)는 랜딩으로(05 사용자 흐름 "예외")
  if (!card) redirect("/");
  const [line1, line2] = shareSentence(card, kstDay(new Date()));

  return (
    <main className={`${s.page} fade`}>
      <header className={s.header}>
        <Link href="/" className={s.logo} aria-label="TailQ 처음으로">
          <Logo />
        </Link>
      </header>

      <div className={s.body}>
        <section className={`glass ${s.card}`} aria-label="결과 카드">
          <p className={s.kicker}>오늘의 기술면접</p>
          <p className={`mono ${s.date}`}>{shareDate(card)}</p>
          <h1 className={s.topic}>{card.topic_name}</h1>
          <div className={s.ring}>
            <ScoreRing
              shown={card.score}
              value={card.score}
              label={`100점 만점에 ${card.score}점`}
            />
          </div>
          <p className={s.who}>
            <b>{shareName(card)}</b>
            {card.streak > 0 && (
              <>
                {" · 꼬리잇기"}
                <b className={`num ${s.streak}`}>{card.streak}</b> 일째
              </>
            )}
          </p>
        </section>

        <p className={s.sentence}>
          {line1}
          <br />
          {line2}
        </p>
        <p className={s.note}>
          <Icon name="lock" size={14} />
          질문 원문과 답변은 공유되지 않아요
        </p>
      </div>

      <div className={s.actions}>
        {/* 랜딩의 체험 구역(#try)으로 */}
        <Link href="/#try" className="btn btn-primary press">
          나도 한 문제 풀어보기
        </Link>
        <Link href="/" className="glass btn btn-secondary press">
          TailQ 알아보기
        </Link>
      </div>
    </main>
  );
}
