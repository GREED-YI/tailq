// 불러오는 동안 화면 읽기 프로그램에 알리는 글. aria-busy 영역 안은 읽히지 않으므로 그 밖에 둔다.
// 자리 표시(.skeleton) 칸은 aria-hidden으로 가린다
export function LoadingStatus() {
  return (
    <p role="status" className="sr-only">
      불러오는 중이에요
    </p>
  );
}
