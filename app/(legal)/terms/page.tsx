import type { Metadata } from "next";
import Link from "next/link";
import { FEEDBACK_URL } from "@/lib/links";
import s from "../legal.module.css";

export const metadata: Metadata = { title: "이용약관 · TailQ" };

export default function TermsPage() {
  return (
    <>
      <h1>이용약관</h1>
      <p className={s.date}>시행일: 2026-10-26</p>
      <div className={`glass ${s.card}`}>
        <h2>
          <span className="mono">01</span> 서비스 내용
        </h2>
        <p>
          TailQ는 매일 기술면접 질문 하나를 내고, 이용자가 쓴 답변을 AI가
          채점하고 꼬리질문을 이어 가는 무료 서비스예요. 복습 일정, 내 프로젝트
          질문, 알림 기능이 있어요.
        </p>

        <h2>
          <span className="mono">02</span> 계정
        </h2>
        <ul>
          <li>GitHub, Google, 카카오 계정으로 가입해요.</li>
          <li>
            만 14세 이상만 가입할 수 있어요. 가입할 때 이 약관과{" "}
            <Link href="/privacy">개인정보처리방침</Link>에 동의해야 해요.
          </li>
          <li>
            언제든 MY 화면에서 탈퇴할 수 있어요. 탈퇴하면 기록이 바로 지워져요.
          </li>
        </ul>

        <h2>
          <span className="mono">03</span> 이용자가 지킬 것
        </h2>
        <ul>
          <li>다른 사람의 계정을 쓰지 않아요.</li>
          <li>
            자동화 도구로 요청을 대량으로 보내거나 질문·모범 답안을 모아 가지
            않아요.
          </li>
          <li>
            사용 한도를 우회하거나 취약점을 이용해 서비스를 방해하지 않아요.
          </li>
          <li>
            답변과 프로젝트 내용에 다른 사람의 개인정보나 권리를 침해하는 내용을
            넣지 않아요.
          </li>
        </ul>
        <p>지키지 않으면 서비스 이용을 제한할 수 있어요.</p>

        <h2>
          <span className="mono">04</span> AI 채점
        </h2>
        <ul>
          <li>
            점수, 피드백, 꼬리질문, 모범 답안은 학습을 돕는 참고 자료예요.
            정확성을 보장하지 않고, 실제 면접 결과와 다를 수 있어요.
          </li>
          <li>
            AI 비용 때문에 하루 사용 한도가 있고, 서비스 전체 예산을 다 쓰면 AI
            기능이 잠시 멈출 수 있어요.
          </li>
        </ul>

        <h2>
          <span className="mono">05</span> 콘텐츠와 저작권
        </h2>
        <ul>
          <li>
            질문, 모범 답안, 채점 기준, 화면 디자인의 권리는 TailQ에 있어요.
            개인 학습에는 자유롭게 쓰되, 복제해서 다시 배포하지 않아요.
          </li>
          <li>
            내가 쓴 답변과 프로젝트 내용의 권리는 나에게 있어요. TailQ는 채점,
            질문 생성, 기록 보여주기에만 써요.
          </li>
          <li>공유 카드는 내가 공유를 눌렀을 때만 만들어져요.</li>
        </ul>

        <h2>
          <span className="mono">06</span> 서비스 변경과 중단
        </h2>
        <p>
          기능은 바뀌거나 없어질 수 있고, 서비스를 끝낼 수도 있어요. 서비스를
          끝낼 때는 미리 서비스 화면에서 알려요.
        </p>

        <h2>
          <span className="mono">07</span> 책임 제한
        </h2>
        <p>
          TailQ는 무료로 제공해요. 운영자의 고의나 중대한 과실이 아니라면,
          서비스 이용이나 AI 채점 결과로 생긴 손해는 책임지지 않아요.
        </p>

        <h2>
          <span className="mono">08</span> 약관 변경
        </h2>
        <p>
          약관을 바꾸면 시행 7일 전에 서비스 화면에서 알려요. 이용자에게 불리한
          변경은 30일 전에 알려요. 바뀐 약관에 동의하지 않으면 탈퇴할 수 있어요.
        </p>

        <h2>
          <span className="mono">09</span> 문의
        </h2>
        <p>
          <Link href={FEEDBACK_URL}>피드백 화면</Link>으로 보내 주세요. 출시
          전에 전용 연락처를 이 자리에 적을게요.
        </p>
      </div>
    </>
  );
}
