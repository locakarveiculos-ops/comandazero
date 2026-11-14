"use client";

import { ArrowLeft, Check, LogOut } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
import { BrandLogo, SaasSurface, ThemeToggle, useSaasTheme } from "@/components/brand-switcher";
import { Button, Field, Input } from "@/components/ui";
import { saasBrand } from "@/config/saas-brand";
import { authErrorPt } from "@/lib/auth-errors";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import { cn, formatPhone, isValidBrPhone, toWhatsappNumber } from "@/lib/utils";

type Mode = "entrar" | "cadastro" | "recuperar";

const TITLE: Record<Mode, string> = {
  entrar: "Entrar no painel",
  cadastro: "Criar sua conta",
  recuperar: "Recuperar senha",
};
const RESEND_SECONDS = 60;
const GOOGLE = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";

/** URL pública para os links de e-mail (NEXT_PUBLIC_SITE_URL em produção; origem atual em desenvolvimento). */
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/+$/, "");
const callback = (next?: string) => `${siteUrl()}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;

/** Login, cadastro e recuperação de senha do SaaS (Supabase Auth). A nova senha é definida em /redefinir-senha. */
export function AuthScreen() {
  const params = useSearchParams();
  const dark = useSaasTheme() === "dark";
  const initial = params.get("modo");
  const [mode, setMode] = useState<Mode>(initial === "cadastro" || initial === "recuperar" ? initial : "entrar");
  const notice = params.get("erro");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<{ text: string; kind: "signup" | "recovery" } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [user, setUser] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const next = params.get("next")?.startsWith("/") && !params.get("next")!.startsWith("//") ? params.get("next")! : "/painel";

  useEffect(() => {
    // Links antigos de recuperação apontavam para /entrar?modo=nova-senha.
    if (initial === "nova-senha") window.location.replace(new URL("/redefinir-senha", window.location.origin).href);
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser(data.user?.email ?? null));
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      setUser(session?.user?.email ?? null);
      if (event === "PASSWORD_RECOVERY") window.location.assign(new URL("/redefinir-senha", window.location.origin).href);
    });
    return () => data.subscription.unsubscribe();
  }, [initial]);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = "Informe um e-mail válido";
    if (mode !== "recuperar" && password.length < 8) e.password = "Mínimo de 8 caracteres";
    if (mode === "cadastro") {
      if (name.trim().length < 2) e.name = "Informe seu nome";
      if (!isValidBrPhone(whatsapp)) e.whatsapp = "Informe DDD + número, ex.: (19) 99999-0000";
      if (!terms) e.terms = "Para criar a conta, aceite os Termos de Uso e a Política de Privacidade";
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const sendSignup = async () => {
    const sb = getSupabase()!;
    const now = new Date().toISOString();
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: callback("/auth/confirmado"),
        // Aceite fica gravado na conta (versão + data); o banco copia para legal_acceptances no gatilho de novo usuário.
        data: {
          name: name.trim(),
          whatsapp: toWhatsappNumber(whatsapp),
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          terms_accepted_at: now,
          marketing_whatsapp_opt_in: marketing,
        },
      },
    });
    if (error) throw error;
    // Sem confirmação obrigatória a sessão já vem pronta: segue para criar a loja.
    if (data.session) return window.location.assign(new URL("/painel/nova-loja", window.location.origin).href);
    setSent({ kind: "signup", text: `Enviamos um link de confirmação para ${email.trim()}. Abra o e-mail “Confirme sua conta na ComandaZero”.` });
    setCooldown(RESEND_SECONDS);
  };

  const sendRecovery = async () => {
    const { error } = await getSupabase()!.auth.resetPasswordForEmail(email.trim(), { redirectTo: callback("/redefinir-senha") });
    if (error) throw error;
    setSent({ kind: "recovery", text: `Se ${email.trim()} tiver conta, você vai receber o link para criar uma nova senha. Ele vale por 1 hora.` });
    setCooldown(RESEND_SECONDS);
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const sb = getSupabase();
    if (!sb) return toast.error("Autenticação indisponível neste ambiente.");
    setLoading(true);
    try {
      if (mode === "entrar") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        // Navegação completa: o servidor lê o cookie de sessão novo e decide a loja e o papel.
        window.location.assign(new URL(next, window.location.origin).href);
      } else if (mode === "cadastro") await sendSignup();
      else await sendRecovery();
    } catch (e) {
      toast.error(authErrorPt((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown || !sent) return;
    setLoading(true);
    try {
      if (sent.kind === "recovery") await sendRecovery();
      else {
        const { error } = await getSupabase()!.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: callback("/auth/confirmado") } });
        if (error) throw error;
        setCooldown(RESEND_SECONDS);
      }
      toast.success("E-mail reenviado");
    } catch (e) {
      toast.error(authErrorPt((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const { error } = await getSupabase()!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback(next) } });
    if (error) toast.error(authErrorPt(error.message));
  };

  const go = (m: Mode) => {
    setMode(m);
    setSent(null);
    setErrors({});
  };

  const linkCls = "font-semibold text-cz-gold-text underline underline-offset-2";

  return (
    <SaasSurface className="grid lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-cz-navy p-12 text-[#faf8f5] lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#d4af6b 1px, transparent 1px)", backgroundSize: "22px 22px" }} aria-hidden />
        <Link href="/" aria-label="ComandaZero, início" className="relative">
          <BrandLogo variant="slogan" height={56} onDark />
        </Link>
        <ul className="relative grid gap-4 text-lg">
          {["Cardápio instalável com a marca da sua loja", "PDV, mesas e cozinha conectados em tempo real", "Pedidos com aviso no WhatsApp da loja"].map((t) => (
            <li key={t} className="flex gap-3">
              <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-cz-gold text-cz-navy">
                <Check className="size-4" aria-hidden />
              </span>
              {t}
            </li>
          ))}
        </ul>
        <p className="relative text-sm text-[#c5cbd5]">{saasBrand.slogan}</p>
      </aside>

      <main id="conteudo" className="flex min-h-screen flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-[10px] px-2 text-sm font-semibold hover:bg-cz-surface-2">
            <ArrowLeft className="size-4" aria-hidden /> Início
          </Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <div className="mb-8 lg:hidden">
            <BrandLogo variant="vertical-slogan" height={120} onDark={dark} className="mx-auto" />
          </div>
          <h1 className="cz-heading text-3xl font-bold">{TITLE[mode]}</h1>
          <p className="mt-1 text-cz-muted">{mode === "cadastro" ? "Comece a vender pelo seu próprio app em minutos." : mode === "recuperar" ? "Enviamos um link para o seu e-mail." : "Acesse o painel da sua loja."}</p>

          {user && mode === "entrar" && (
            <div className="mt-6 flex items-center justify-between gap-3 rounded-[10px] border border-cz-border bg-cz-surface p-3 text-sm">
              <span>
                Conectado como <b>{user}</b>
              </span>
              <button type="button" onClick={() => getSupabase()?.auth.signOut()} className="inline-flex min-h-11 items-center gap-1 rounded-[10px] px-2 font-semibold hover:bg-cz-surface-2">
                <LogOut className="size-4" aria-hidden /> Sair
              </button>
            </div>
          )}

          {notice === "sem-loja" && (
            <p className="mt-6 rounded-[10px] bg-cz-info/10 p-3 text-sm">
              Sua conta ainda não tem loja. <Link href="/painel/nova-loja" className="font-semibold underline">Criar minha loja</Link>
            </p>
          )}
          {notice === "link-invalido" && (
            <p role="alert" className="mt-6 rounded-[10px] border border-cz-error/40 bg-cz-surface p-3 text-sm">
              Link vencido ou já usado. {mode === "recuperar" ? "Informe o e-mail para receber outro." : "Entre com sua senha ou peça um novo link."}
            </p>
          )}
          {!supabaseConfigured() && <p className="mt-6 rounded-[10px] border border-cz-border bg-cz-surface p-3 text-sm">Autenticação não configurada neste ambiente. A demonstração do painel continua aberta.</p>}

          {sent ? (
            <div role="status" className="mt-8 rounded-[14px] border border-cz-border bg-cz-surface p-5">
              <p className="font-semibold">Confira seu e-mail</p>
              <p className="mt-1 text-sm text-cz-muted">{sent.text}</p>
              <p className="mt-2 text-sm text-cz-muted">Não chegou? Olhe a pasta de spam ou promoções.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" onClick={resend} disabled={cooldown > 0} loading={loading}>
                  {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar e-mail"}
                </Button>
                <Button variant="secondary" onClick={() => go("entrar")}>
                  Voltar para entrar
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-8 grid gap-4">
              {mode === "cadastro" && (
                <Field label="Seu nome" id="nome" error={errors.name}>
                  <Input id="nome" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? "nome-error" : undefined} />
                </Field>
              )}
              <Field label="E-mail" id="email" error={errors.email}>
                <Input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
              </Field>
              {mode === "cadastro" && (
                <Field label="WhatsApp" id="whatsapp" error={errors.whatsapp} hint="Para avisos importantes da sua conta">
                  <Input
                    id="whatsapp"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="(19) 99999-0000"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                    aria-invalid={!!errors.whatsapp}
                    aria-describedby={errors.whatsapp ? "whatsapp-error" : "whatsapp-hint"}
                  />
                </Field>
              )}
              {mode !== "recuperar" && (
                <Field label="Senha" id="senha" error={errors.password} hint={mode === "entrar" ? undefined : "Mínimo de 8 caracteres"}>
                  <PasswordInput
                    id="senha"
                    autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    showStrength={mode === "cadastro"}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "senha-error" : mode === "cadastro" ? "senha-hint" : undefined}
                  />
                </Field>
              )}
              {mode === "cadastro" && (
                <div className="grid gap-2 text-sm">
                  <label className="flex min-h-11 items-start gap-3">
                    <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#0b1f40]" aria-invalid={!!errors.terms} aria-describedby={errors.terms ? "termos-error" : undefined} />
                    <span>
                      Li e aceito os{" "}
                      <Link href="/termos" target="_blank" className={linkCls}>
                        Termos de Uso
                      </Link>{" "}
                      e a{" "}
                      <Link href="/privacidade" target="_blank" className={linkCls}>
                        Política de Privacidade
                      </Link>
                      .
                    </span>
                  </label>
                  {errors.terms && (
                    <p id="termos-error" role="alert" className="text-xs font-semibold text-ui-error">
                      {errors.terms}
                    </p>
                  )}
                  <label className="flex min-h-11 items-start gap-3 text-cz-muted">
                    <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#0b1f40]" />
                    <span>Quero receber novidades e dicas da ComandaZero pelo WhatsApp (opcional, cancele quando quiser).</span>
                  </label>
                </div>
              )}
              {mode === "entrar" && (
                <button type="button" onClick={() => go("recuperar")} className="inline-flex min-h-11 items-center justify-self-end text-sm font-semibold text-cz-gold-text underline-offset-2 hover:underline">
                  Esqueci minha senha
                </button>
              )}
              <Button type="submit" variant="brand" size="lg" loading={loading}>
                {mode === "entrar" ? "Entrar" : mode === "cadastro" ? "Criar conta" : "Enviar link"}
              </Button>
              {GOOGLE && mode !== "recuperar" && (
                <Button type="button" variant="outline" size="lg" onClick={google}>
                  Continuar com Google
                </Button>
              )}
            </form>
          )}

          <div className="mt-6 text-center text-sm text-cz-muted">
            {mode === "entrar" ? (
              <>
                Ainda não tem conta?{" "}
                <button type="button" onClick={() => go("cadastro")} className={cn("inline-flex min-h-11 items-center font-semibold text-cz-gold-text underline-offset-2 hover:underline")}>
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button type="button" onClick={() => go("entrar")} className="inline-flex min-h-11 items-center font-semibold text-cz-gold-text underline-offset-2 hover:underline">
                  Entrar
                </button>
              </>
            )}
          </div>
          <p className="mt-2 text-center text-sm">
            <Link href="/painel/cafe-e-flor" className="inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline">
              Ver demonstração do painel sem login
            </Link>
          </p>
        </div>
      </main>
    </SaasSurface>
  );
}
