"use client";

import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { Icon } from "@/components/icons";
import { hourLabel } from "@/lib/profile";
import {
  SUBSCRIBE_ERRORS,
  subscribePush,
  unsubscribePush,
} from "@/lib/push-client";
import { THEME_STORAGE_KEY, type ThemeName } from "@/lib/theme";
import p from "../../my/my.module.css";
import s from "./my.module.css";
import { openModal, useCloseOnLeave } from "@/lib/dialog";

// 가운데 확인 창(S30 로그아웃 확인 모양). 브라우저 기본 <dialog>라 Esc·바깥 포커스 막기가 된다
function Dialog({
  ref,
  title,
  children,
}: {
  ref: RefObject<HTMLDialogElement | null>;
  title: string;
  children: ReactNode;
}) {
  return (
    <dialog
      ref={ref}
      className={`glass-strong ${s.dialog}`}
      aria-label={title}
      // 바깥(어두운 바탕)을 누르면 닫는다
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}

// 설정 목록의 한 줄. 누르면 창을 연다
function SettingRow(props: {
  title: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`hover-row ${s.row}`}
        onClick={props.onClick}
      >
        <span className={s.rowText}>
          <strong>{props.title}</strong>
          <span className="num">{props.meta}</span>
        </span>
        <Icon name="chevronRight" size={18} />
      </button>
    </li>
  );
}

export function LogoutButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  useCloseOnLeave(dialog);
  return (
    <>
      <button
        type="button"
        className={`btn btn-md btn-secondary glass press ${s.accountBtn}`}
        onClick={() => openModal(dialog.current)}
      >
        로그아웃
      </button>
      <Dialog ref={dialog} title="로그아웃할까요?">
        <p>
          같은 방법으로 다시 로그인하면
          <br />
          기록이 그대로 있어요.
        </p>
        <form action="/auth/logout" method="post" className={s.dialogButtons}>
          <button
            type="button"
            className="btn btn-md btn-secondary glass press"
            onClick={() => dialog.current?.close()}
          >
            취소
          </button>
          <button type="submit" className="btn btn-md btn-primary press">
            로그아웃
          </button>
        </form>
      </Dialog>
    </>
  );
}

// 알림 켜기·끄기와 시각(1시간 단위). 켜 둔 채 저장하면 이 기기의 권한을 받고 구독한다(온보딩 S08과 같다).
// 못 켜면(거부, 홈 화면에 추가하지 않은 아이폰 등) 저장하지 않고 안내한다. 끄면 이 기기의 구독을 지운다.
export function NotifyRow({
  on,
  hour,
  vapidKey,
  subscriptions,
}: {
  on: boolean;
  hour: number;
  vapidKey: string;
  subscriptions: { id: string; endpoint: string }[];
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  useCloseOnLeave(dialog);
  const [nextOn, setNextOn] = useState(on);
  const [nextHour, setNextHour] = useState(hour);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const open = () => {
    setNextOn(on);
    setNextHour(hour);
    setError("");
    openModal(dialog.current);
  };

  async function save() {
    setBusy(true);
    setError("");
    if (nextOn) {
      const result = await subscribePush(vapidKey);
      if (result !== "ok") {
        setBusy(false);
        return setError(SUBSCRIBE_ERRORS[result]);
      }
    }
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notifyOn: nextOn, notifyHour: nextHour }),
    }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      return setError("저장하지 못했어요. 다시 시도해 주세요.");
    }
    // 끄기는 저장된 뒤에 구독을 지운다(저장이 실패하면 켜진 채로 기기 구독만 사라지지 않게).
    // 구독을 못 지워도 notify_on이 꺼졌으니 보내지 않는다
    if (!nextOn && on) await unsubscribePush(subscriptions).catch(() => {});
    setBusy(false);
    router.refresh();
    dialog.current?.close();
  }

  return (
    <>
      <SettingRow
        title="알림"
        meta={on ? `켜짐 · ${hourLabel(hour)}` : "꺼짐"}
        onClick={open}
      />
      <Dialog ref={dialog} title="알림">
        <div className={s.dialogRow}>
          <span id="notify-label">매일 질문 알림</span>
          <button
            type="button"
            role="switch"
            aria-checked={nextOn}
            aria-labelledby="notify-label"
            className={`press ${p.switch}`}
            onClick={() => setNextOn(!nextOn)}
          />
        </div>
        <label className={s.dialogRow}>
          <span>알림 시각</span>
          <select
            className={s.select}
            value={nextHour}
            disabled={!nextOn}
            onChange={(e) => setNextHour(Number(e.target.value))}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className={s.dialogError}>
            {error}
          </p>
        )}
        <div className={s.dialogButtons}>
          <button
            type="button"
            className="btn btn-md btn-secondary glass press"
            onClick={() => dialog.current?.close()}
          >
            취소
          </button>
          <button
            type="button"
            className="btn btn-md btn-primary press"
            disabled={busy}
            onClick={save}
          >
            저장
          </button>
        </div>
      </Dialog>
    </>
  );
}

type ThemeChoice = ThemeName | "system";
const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: "system", label: "기기 설정 따르기" },
  { id: "light", label: "라이트" },
  { id: "dark", label: "다크" },
];

// 저장한 선택(localStorage). 헤더의 테마 토글로 바꿔도 따라가도록 data-theme 변화를 지켜본다
function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}
function watchTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}
// 기기 설정이면 저장값을 지워 첫 그림 스크립트가 기기 설정을 따르게 한다
function applyTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // 저장소를 못 쓰면 이번 방문 동안만 바뀐다
  }
  document.documentElement.dataset.theme =
    choice !== "system"
      ? choice
      : matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
}

// 화면 테마는 지금처럼 이 기기에만 기억한다(lib/theme.ts의 첫 그림 스크립트가 읽는 값).
// 고르면 바로 바뀌어 보이고, 창은 닫기로 닫는다
export function ThemeRow() {
  const dialog = useRef<HTMLDialogElement>(null);
  useCloseOnLeave(dialog);
  const theme = useSyncExternalStore(watchTheme, readTheme, () => "system");

  return (
    <>
      <SettingRow
        title="화면 테마"
        meta={THEMES.find((t) => t.id === theme)!.label}
        onClick={() => openModal(dialog.current)}
      />
      <Dialog ref={dialog} title="화면 테마">
        <p id="theme-mode-label">모드</p>
        <div
          role="radiogroup"
          aria-labelledby="theme-mode-label"
          className={s.choicesCol}
          style={{ marginTop: 10 }}
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              className="chip glass press"
              onClick={() => applyTheme(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={s.dialogButtons} style={{ gridTemplateColumns: "1fr" }}>
          <button
            type="button"
            className="btn btn-md btn-secondary glass press"
            onClick={() => dialog.current?.close()}
          >
            닫기
          </button>
        </div>
      </Dialog>
    </>
  );
}
