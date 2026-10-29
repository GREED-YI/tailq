// @vitest-environment jsdom
import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { nextRadio, radioStep, useRadioGroup } from "@/lib/radio-group";

const VALUES = ["system", "light", "dark"] as const;

// 묶음 div와 radio 버튼 셋을 문서에 그린다
function mount() {
  const group = document.createElement("div");
  group.innerHTML = VALUES.map(
    (v) => `<button role="radio" data-v="${v}">${v}</button>`,
  ).join("");
  document.body.replaceChildren(group);
  return { group, radios: [...group.querySelectorAll("button")] };
}

function press(
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void,
  key: string,
  group: HTMLElement,
  target: HTMLElement,
) {
  const preventDefault = vi.fn();
  onKeyDown({
    key,
    preventDefault,
    currentTarget: group,
    target,
  } as unknown as KeyboardEvent<HTMLElement>);
  return preventDefault;
}

describe("radioStep · nextRadio (방향키 이동)", () => {
  it("→↓는 뒤로, ←↑는 앞으로, 다른 키는 움직이지 않는다", () => {
    expect(radioStep("ArrowRight")).toBe(1);
    expect(radioStep("ArrowDown")).toBe(1);
    expect(radioStep("ArrowLeft")).toBe(-1);
    expect(radioStep("ArrowUp")).toBe(-1);
    expect(radioStep("Tab")).toBe(0);
    expect(radioStep(" ")).toBe(0);
  });

  it("끝에서는 반대쪽 끝으로 돈다", () => {
    expect(nextRadio(0, 1, 3)).toBe(1);
    expect(nextRadio(2, 1, 3)).toBe(0);
    expect(nextRadio(0, -1, 3)).toBe(2);
  });
});

describe("useRadioGroup (roving tabindex)", () => {
  it("Tab은 고른 칸 하나에만 멈춘다", () => {
    const { radio } = useRadioGroup(VALUES, "light", () => {});
    expect(VALUES.map((v) => radio(v).tabIndex)).toEqual([-1, 0, -1]);
    expect(VALUES.map((v) => radio(v)["aria-checked"])).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("고른 칸이 없으면 첫 칸에 멈춘다", () => {
    const { radio } = useRadioGroup<string>(VALUES, "none", () => {});
    expect(VALUES.map((v) => radio(v).tabIndex)).toEqual([0, -1, -1]);
  });

  it("방향키는 옆 칸을 고르고 초점도 옮긴다", () => {
    const { group, radios } = mount();
    const onChange = vi.fn();
    const { group: g } = useRadioGroup(VALUES, "light", onChange);

    const prevented = press(g.onKeyDown, "ArrowDown", group, radios[1]);
    expect(prevented).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith("dark");
    expect(document.activeElement).toBe(radios[2]);

    press(g.onKeyDown, "ArrowRight", group, radios[2]);
    expect(onChange).toHaveBeenLastCalledWith("system");
    expect(document.activeElement).toBe(radios[0]);

    press(g.onKeyDown, "ArrowUp", group, radios[0]);
    expect(onChange).toHaveBeenLastCalledWith("dark");
  });

  it("방향키가 아니면 아무것도 하지 않는다(Tab·Space는 브라우저 몫)", () => {
    const { group, radios } = mount();
    const onChange = vi.fn();
    const { group: g } = useRadioGroup(VALUES, "light", onChange);
    const prevented = press(g.onKeyDown, "Tab", group, radios[1]);
    expect(prevented).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("누르면 그 칸을 고른다", () => {
    const onChange = vi.fn();
    useRadioGroup(VALUES, "light", onChange).radio("dark").onClick();
    expect(onChange).toHaveBeenCalledWith("dark");
  });
});
