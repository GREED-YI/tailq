import { ComingSoon } from "@/components/ComingSoon";

// MY 화면은 #42에서 만든다. 그전까지 로그아웃만 둔다.
export default function Page() {
  return (
    <>
      <ComingSoon title="MY" issue={42} />
      <form action="/auth/logout" method="post" style={{ marginTop: 24 }}>
        <button
          type="submit"
          className="btn btn-secondary glass press"
          style={{ width: "100%" }}
        >
          로그아웃
        </button>
      </form>
    </>
  );
}
