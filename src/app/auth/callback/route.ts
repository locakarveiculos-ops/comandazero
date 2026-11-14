import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * GET /auth/callback — destino dos links de e-mail do Supabase (confirmação, recuperação, convite, troca de e-mail).
 *  - token_hash + type: links dos modelos em PT-BR (funcionam em qualquer aparelho);
 *  - code: fluxo PKCE (OAuth e links abertos no mesmo navegador do cadastro).
 * A sessão vai para cookie; recuperação de senha segue para /redefinir-senha.
 */
const safeNext = (v: string | null) => (v && v.startsWith("/") && !v.startsWith("//") ? v : null);

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const tokenHash = url.searchParams.get("token_hash");
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const go = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  const sb = await supabaseServer();
  let ok = false;
  if (tokenHash && type) ok = !(await sb.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  else if (code) ok = !(await sb.auth.exchangeCodeForSession(code)).error;

  if (!ok) return go(`/entrar?erro=link-invalido${type === "recovery" ? "&modo=recuperar" : ""}`);
  if (type === "recovery") return go("/redefinir-senha");
  return go(next ?? "/auth/confirmado");
}
