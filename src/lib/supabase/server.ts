import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseReady = () => !!(URL() && ANON());

/** Cliente com a sessão do usuário (cookies). Respeita RLS. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(URL(), ANON(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Component não pode gravar cookie; o proxy renova a sessão.
        }
      },
    },
  });
}

/** Cliente anônimo sem cookies (vitrine pública, acompanhamento por token). Respeita RLS. */
export const supabaseAnon = () => createClient(URL(), ANON(), { auth: { persistSession: false } });

/** service_role: ignora RLS. Só para operações já validadas no servidor (criar pedido, webhooks). */
export function supabaseService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient(URL(), key, { auth: { persistSession: false } });
}
