"use client";

import type { RefObject } from "react";
import { createPortal } from "react-dom";
import my from "@/app/(app)/my/my.module.css";
import { useCloseOnLeave } from "@/lib/dialog";
import { Icon } from "./icons";
import s from "./IosInstallGuide.module.css";

// 아이폰·아이패드 "홈 화면에 추가" 안내(#150). 브라우저가 설치 창을 대신 띄울 수 없어 순서를 그림으로 보여 준다.
// 창 모양은 MY 확인 창(dialog)과 같다. 홈 안내 카드의 목록 스타일이 번지지 않게 body에 붙인다.
// 설치 버튼이 ios-guide일 때만 그리므로(서버·hydration 첫 렌더는 hidden) 여기서 navigator를 읽어도 된다
export function IosInstallGuide({
  ref,
}: {
  ref: RefObject<HTMLDialogElement | null>;
}) {
  useCloseOnLeave(ref);
  const ua = navigator.userAgent;
  const ipad = !/iPhone|iPod/.test(ua);
  const where = /CriOS|FxiOS|EdgiOS/.test(ua)
    ? "브라우저"
    : ipad
      ? "Safari 위쪽"
      : "Safari 아래쪽";

  return createPortal(
    <dialog
      ref={ref}
      className={my.dialog}
      aria-label="홈 화면에 추가하기"
      // 바깥(어두운 바탕)을 누르면 닫는다
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
    >
      <h2>홈 화면에 추가하기</h2>
      <p>
        {ipad ? "아이패드는" : "아이폰은"} 홈 화면에 추가한 앱에서만 알림을 받을
        수 있어요
      </p>
      <ol role="list" className={s.steps}>
        <li>
          <span className="mono" aria-hidden="true">
            01
          </span>
          <div>
            <p>
              {where} <b>공유 버튼</b>을 눌러요
            </p>
            <p className={s.hint}>보이지 않으면 ⋯를 눌러요</p>
          </div>
          <span className={`${s.figure} ${s.square}`} aria-hidden="true">
            <Icon name="share" size={24} />
          </span>
        </li>
        <li>
          <span className="mono" aria-hidden="true">
            02
          </span>
          <p>
            목록에서 <b>&apos;홈 화면에 추가&apos;</b>를 골라요
          </p>
          <span className={s.figure} aria-hidden="true">
            홈 화면에 추가
            <Icon name="squarePlus" size={20} />
          </span>
        </li>
        <li>
          <span className="mono" aria-hidden="true">
            03
          </span>
          <p>
            오른쪽 위 <b>&apos;추가&apos;</b>를 누르면 끝나요
          </p>
          <span className={s.figure} aria-hidden="true">
            추가
          </span>
        </li>
      </ol>
      <p>추가한 뒤 홈 화면의 TailQ를 열어 MY에서 알림을 켜 주세요</p>
      <div className={my.dialogButtons} style={{ gridTemplateColumns: "1fr" }}>
        <button
          type="button"
          className="btn btn-md btn-secondary press"
          onClick={() => ref.current?.close()}
        >
          닫기
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
