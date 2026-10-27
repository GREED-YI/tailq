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
import { THEME_STORAGE_KEY, type ThemeName } from "@/lib/theme";
import p from "../../my/my.module.css";
import s from "./my.module.css";

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
  return (
    <>
      <button
        type="button"
        className={`btn btn-md btn-secondary glass press ${s.accountBtn}`}
        onClick={() => dialog.current?.showModal()}
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

// 알림 켜기·끄기와 시각(1시간 단위). 켤 때 브라우저 알림 권한을 받는다(온보딩 S08과 같다).
// 웹 푸시 구독은 알림 발송 이슈(#37)에서 붙인다.
export function NotifyRow({ on, hour }: { on: boolean; hour: number }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [nextOn, setNextOn] = useState(on);
  const [nextHour, setNextHour] = useState(hour);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const open = () => {
    setNextOn(on);
    setNextHour(hour);
    setError("");
    dialog.current?.showModal();
  };

  async function save() {
    setBusy(true);
    setError("");
    let notifyOn = nextOn;
    if (notifyOn && !on) {
      const permission =
        "Notification" in window
          ? await Notification.requestPermission()
          : "denied";
      notifyOn = permission === "granted";
    }
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notifyOn, notifyHour: nextHour }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("저장하지 못했어요. 다시 시도해 주세요.");
    router.refresh();
    if (nextOn && !notifyOn)
      return setError(
        "브라우저에서 알림이 막혀 있어요. 주소창 왼쪽 아이콘에서 알림을 허용해 주세요.",
      );
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

// 화면 테마는 지금처럼 이 기기에만 기억한다(lib/theme.ts의 첫 그림 스크립트가 읽는 값)
export function ThemeRow() {
  const dialog = useRef<HTMLDialogElement>(null);
  const theme = useSyncExternalStore(watchTheme, readTheme, () => "system");

  function pick(choice: ThemeChoice) {
    applyTheme(choice);
    dialog.current?.close();
  }

  return (
    <>
      <SettingRow
        title="화면 테마"
        meta={THEMES.find((t) => t.id === theme)!.label}
        onClick={() => dialog.current?.showModal()}
      />
      <Dialog ref={dialog} title="화면 테마">
        <div role="radiogroup" aria-label="화면 테마" className={s.choicesCol}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              className="chip glass press"
              onClick={() => pick(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Dialog>
    </>
  );
}
