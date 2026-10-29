import { execSync } from "node:child_process";
import type { BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// 로그인한 화면 e2e. 로컬 Supabase가 떠 있을 때만 쓴다(CI e2e는 Supabase 없이 돈다).
// 키는 환경 파일이 아니라 로컬 Supabase CLI에서 읽는다. 없으면 null이고 그 테스트는 건너뛴다
function localSupabase() {
  try {
    const out = execSync("npx supabase status -o json", {
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 60_000,
    }).toString();
    const s = JSON.parse(out.slice(out.indexOf("{")));
    return {
      url: s.API_URL as string,
      anonKey: s.ANON_KEY as string,
      serviceKey: s.SERVICE_ROLE_KEY as string,
    };
  } catch {
    return null;
  }
}
export const supabase = localSupabase();

// 데모 쿠키 로그인: 서비스 키로 매직 링크를 만들어 바로 세션으로 바꾸고, @supabase/ssr과 같은 모양
// (sb-<host>-auth-token=base64-…, 3180자마다 .0 .1 조각)의 쿠키로 넣는다.
// 처음 쓰는 이메일이면 계정을 만들고 온보딩을 마친 상태로 둔다. 테스트가 데이터를 만들고 RLS를 볼 수 있게 세션을 돌려준다
export async function login(context: BrowserContext, email: string) {
  const { url, anonKey, serviceKey } = supabase!;
  const options = { auth: { persistSession: false } };
  const admin = createClient(url, serviceKey, options);
  await admin.auth.admin.createUser({ email, email_confirm: true }); // 이미 있으면 오류만 돌려준다
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;

  const { data: topic } = await admin
    .from("topics")
    .select("id")
    .limit(1)
    .single();
  const now = new Date().toISOString();
  await admin
    .from("profiles")
    .update({
      agreed_at: now,
      topics: [topic!.id],
      levels: ["basic"],
      onboarded_at: now,
    })
    .eq("id", link.user.id)
    .is("onboarded_at", null);

  const { data, error: verifyError } = await createClient(
    url,
    anonKey,
    options,
  ).auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError || !data.session) throw verifyError;

  const name = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(data.session)).toString("base64url")}`;
  const chunks = value.match(/.{1,3180}/g)!;
  await context.addCookies(
    chunks.map((v, i) => ({
      name: chunks.length === 1 ? name : `${name}.${i}`,
      value: v,
      url: "http://localhost:3000",
    })),
  );
  return data.session;
}
