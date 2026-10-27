import { useLayoutEffect, type RefObject } from "react";

// 확인 창(<dialog>)을 모달로 연다. 앞 화면을 상태 그대로 보관(cacheComponents)했다가 다시 보여 주면
// 창이 '열림' 표시만 남은 채 모달 상태를 잃을 수 있어, 그대로 showModal()을 부르면 InvalidStateError가 난다.
// 이미 열려 있으면 닫았다가 다시 연다
export function openModal(dialog: HTMLDialogElement | null | undefined) {
  if (!dialog) return;
  if (dialog.open) dialog.close();
  dialog.showModal();
}

// 화면을 떠날 때(보관되어 숨겨질 때도 effect 정리가 돈다) 열린 확인 창을 닫는다.
// 레이아웃 effect라 화면이 숨겨지기 전에 닫힌다.
// 닫지 않으면 돌아왔을 때 창이 모달이 아닌 채로 화면 위에 떠 있다
export function useCloseOnLeave(ref: RefObject<HTMLDialogElement | null>) {
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => dialog?.close();
  }, [ref]);
}
