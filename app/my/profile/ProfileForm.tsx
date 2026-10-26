"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { BackButton } from "@/components/BackButton";
import f from "@/components/Flow.module.css";
import { Icon } from "@/components/icons";
import {
  AVATARS,
  avatarChoice,
  Nickname,
  nicknameLength,
  type AvatarChoice,
} from "@/lib/profile";
import s from "../my.module.css";

const AVATAR_LABELS: Record<AvatarChoice, string> = {
  social: "소셜 계정 사진",
  mint: "기본 아바타 민트",
  sky: "기본 아바타 하늘",
  orange: "기본 아바타 주황",
};

export function ProfileForm(props: {
  nickname: string;
  avatar: string | null;
  shareNickname: boolean;
  socialPhoto: string | null;
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState(props.nickname);
  const [avatar, setAvatar] = useState(avatarChoice(props.avatar));
  const [share, setShare] = useState(props.shareNickname);
  const [tip, setTip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // 규칙에 맞지 않으면 저장 버튼을 잠그고 안내 글씨를 빨갛게 바꾼다
  const valid = Nickname.safeParse(nickname).success;
  // 고른 선택지를 저장했을 때 보일 모습(소셜이면 로그인 정보의 사진)
  const shown = (c: AvatarChoice) => (c === "social" ? props.socialPhoto : c);

  async function save() {
    setBusy(true);
    setFailed(false);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname, avatar, shareNickname: share }),
    }).catch(() => null);
    if (res?.ok) {
      // 닉네임·이미지를 쓰는 화면이 새 값으로 다시 그려지게 한다
      router.replace("/my");
      router.refresh();
      return;
    }
    setFailed(true);
    setBusy(false);
  }

  return (
    <>
      <header className={`${f.top} ${s.top}`}>
        <BackButton className={`${f.back} ${s.back}`} />
        <h1 className={f.topTitle}>프로필</h1>
        <button
          type="button"
          className={`glass press ${s.pill} ${s.save}`}
          disabled={!valid || busy}
          onClick={save}
        >
          저장
        </button>
      </header>

      <h2 className={s.label} id="avatar-label">
        프로필 이미지
      </h2>
      <div className={`glass ${s.avatarCard}`}>
        <Avatar
          avatar={shown(avatar)}
          nickname={nickname || props.nickname}
          size={72}
          className={s.preview}
        />
        <div
          role="radiogroup"
          aria-labelledby="avatar-label"
          className={s.choices}
        >
          {AVATARS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={avatar === c}
              aria-label={AVATAR_LABELS[c]}
              className={`press ${s.choice}`}
              onClick={() => setAvatar(c)}
            >
              <Avatar
                avatar={shown(c)}
                nickname={nickname || props.nickname}
                size={44}
              />
            </button>
          ))}
        </div>
      </div>
      <p className={s.help}>소셜 계정 사진이나 기본 아바타 중에서 골라요</p>

      <label htmlFor="nickname" className={`${s.label} ${s.gap}`}>
        닉네임
      </label>
      <input
        id="nickname"
        className={`glass ${s.input}`}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        autoComplete="nickname"
        aria-invalid={!valid}
        aria-describedby="nickname-help"
      />
      <p className={s.helpRow} data-invalid={!valid || undefined}>
        <span id="nickname-help">2~12자로 입력해 주세요</span>
        <span className="mono" aria-hidden="true">
          {nicknameLength(nickname)} / 12
        </span>
      </p>

      <div className={`glass ${s.switchRow}`}>
        <span className={s.switchTitle}>
          <span id="share-label">공유 카드에 닉네임 표시</span>
          <button
            type="button"
            className={s.info}
            aria-label="설명 보기"
            aria-expanded={tip}
            aria-controls="share-tip"
            onClick={() => setTip(!tip)}
          >
            <Icon name="info" size={16} />
          </button>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={share}
          aria-labelledby="share-label"
          className={s.switch}
          onClick={() => setShare(!share)}
        />
        {tip && (
          <p id="share-tip" className={`glass-strong ${s.tip}`}>
            끄면 공유 카드에 &apos;TailQ 사용자&apos;로 표시돼요
          </p>
        )}
      </div>

      {failed && (
        <p role="alert" className={s.alert}>
          저장하지 못했어요. 다시 시도해 주세요.
        </p>
      )}
    </>
  );
}
