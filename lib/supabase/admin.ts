import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// 서버 전용 권한(service_role). RLS를 건너뛰므로 로그인한 사용자를 먼저 확인한 뒤
// 그 사용자 행만 쓴다(08 설계 "데이터 읽고 쓰는 길"). 브라우저 코드에서 import하지 않는다.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
