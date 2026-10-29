import type { KeyboardEvent } from "react";

// 방향키가 옮길 칸 수. ←↑는 앞, →↓는 뒤. 다른 키는 0
export function radioStep(key: string) {
  if (key === "ArrowRight" || key === "ArrowDown") return 1;
  if (key === "ArrowLeft" || key === "ArrowUp") return -1;
  return 0;
}

// 지금 칸(from)에서 step만큼 옮긴 칸. 끝에서는 반대쪽 끝으로 돈다
export function nextRadio(from: number, step: number, length: number) {
  return (from + step + length) % length;
}

// role=radio 버튼 묶음(ARIA radiogroup)의 키보드. 화면 테마 · 프로필 이미지 · 피드백 분류가 같이 쓴다.
// Tab은 묶음에서 한 번만 멈추고(고른 칸만 tabIndex 0, 고른 게 없으면 첫 칸), 방향키는 옆 칸을 고르며 초점도 옮긴다.
// 묶음에 group을, 칸마다 radio(값)을 펼쳐 넣는다
export function useRadioGroup<T>(
  values: readonly T[],
  value: T,
  onChange: (value: T) => void,
) {
  const checked = values.indexOf(value);
  return {
    group: {
      role: "radiogroup",
      onKeyDown(e: KeyboardEvent<HTMLElement>) {
        const step = radioStep(e.key);
        if (!step) return;
        e.preventDefault();
        const radios = [
          ...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'),
        ];
        const from = radios.indexOf(e.target as HTMLElement);
        const i = nextRadio(
          from < 0 ? Math.max(checked, 0) : from,
          step,
          values.length,
        );
        onChange(values[i]);
        radios[i]?.focus();
      },
    },
    radio: (v: T) => ({
      role: "radio",
      "aria-checked": v === value,
      tabIndex: v === value || (checked < 0 && v === values[0]) ? 0 : -1,
      onClick: () => onChange(v),
    }),
  };
}
