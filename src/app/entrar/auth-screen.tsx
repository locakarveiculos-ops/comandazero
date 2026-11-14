"use client";

import { ArrowLeft, Check, LogOut } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandLogo, SaasSurface, ThemeToggle, useSaasTheme } from "@/components/brand-switcher";
import { Button, Field, Input } from "@/components/ui";
import { saasBrand } from "@/config/saas-brand";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "entrar" | "cadastro" | "recuperar" | "nova-senha";

const TITLE: Record<Mode, string> = {
  entrar: "Entrar no painel",
  cadastro: "Criar sua conta",
  recuperar: "Recuperar senha",
  "nova-senha": "Definir nova senha",
};

/** Login, cadastro e recuperação de senha do SaaS (Supabase Auth). */
export function AuthScreen() {
  const params = useSearchParams();
  const dark = useSaasTheme() === "dark";
  const [mode, setMode] = useState<Mode>(() => (params.get("modo") as Mode) || "entrar");
  const semLoja = params.get("erro") === "sem-loja";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/painel";

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser(data.user?.email ?? null));
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      setUser(session?.user?.email ?? null);
      if (event === "PASSWORD_RECOVERY") setMode("nova-senha");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (mode !== "nova-senha" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = "Informe um e-mail válido";
    if ((mode === "entrar" || mode === "cadastro" || mode === "nova-senha") && password.length < 8) e.password = "Mínimo de 8 caracteres";
    if (mode === "cadastro" && name.trim().length < 2) e.name = "Informe seu nome";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const sb = getSupabase();
    if (!sb) return toast.error("Autenticação indisponível: Supabase não configurado neste ambiente.");
    setLoading(true);
    const redirectTo = `${window.location.origin}/entrar?modo=nova-senha`;
    try {
      if (mode === "entrar") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        // Navegação completa: o servidor lê o cookie de sessão novo e decide a loja e o papel.
        window.location.assign(new URL(next, window.location.origin).href);
      } else if (mode === "cadastro") {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name: name.trim() }, emailRedirectTo: `${window.location.origin}/painel/nova-loja` } });
        if (error) throw error;
        // Sem confirmação de e-mail a sessão já vem pronta: segue para criar a loja.
        if (data.session) return window.location.assign(new URL("/painel/nova-loja", window.location.origin).href);
        setSent(`Enviamos um link de confirmação para ${email}.`);
      } else if (mode === "recuperar") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        setSent(`Se ${email} tiver conta, você vai receber o link para criar uma nova senha.`);
      } else {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Senha atualizada");
        window.location.assign(new URL(next, window.location.origin).href);
      }
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(/invalid login/i.test(msg) ? "E-mail ou senha incorretos." : /already registered/i.test(msg) ? "Este e-mail já tem conta. Entre ou recupere a senha." : msg);
    } finally {
      setLoading(false);
    }
  };

  const go = (m: Mode) => {
    setMode(m);
    setSent("");
    setErrors({});
  };

  return (
    <SaasSurface className="grid lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-cz-navy p-12 text-[#faf8f5] lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#d4af6b 1px, transparent 1px)", backgroundSize: "22px 22px" }} aria-hidden />
        <Link href="/" aria-label="ComandaZero, início" className="relative">
          <BrandLogo variant="slogan" height={56} onDark />
        </Link>
        <ul className="relative grid gap-4 text-lg">
          {["Cardápio instalável com a marca da sua loja", "PDV, mesas e cozinha conectados em tempo real", "WhatsApp com botões e Pix com confirmação automática"].map((t) => (
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

          {semLoja && (
            <p className="mt-6 rounded-[10px] bg-cz-info/10 p-3 text-sm">
              Sua conta ainda não tem loja. <Link href="/painel/nova-loja" className="font-semibold underline">Criar minha loja</Link>
            </p>
          )}
          {!supabaseConfigured() && <p className="mt-6 rounded-[10px] bg-cz-warning/10 p-3 text-sm text-cz-warning">Supabase não configurado neste ambiente. A demonstração do painel continua aberta.</p>}

          {sent ? (
            <div role="status" className="mt-8 rounded-[14px] border border-cz-border bg-cz-surface p-5">
              <p className="font-semibold">Confira seu e-mail</p>
              <p className="mt-1 text-sm text-cz-muted">{sent}</p>
              <Button variant="secondary" className="mt-4" onClick={() => go("entrar")}>
                Voltar para entrar
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-8 grid gap-4">
              {mode === "cadastro" && (
                <Field label="Seu nome" id="nome" error={errors.name}>
                  <Input id="nome" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? "nome-error" : undefined} />
                </Field>
              )}
              {mode !== "nova-senha" && (
                <Field label="E-mail" id="email" error={errors.email}>
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
                </Field>
              )}
              {mode !== "recuperar" && (
                <Field label={mode === "nova-senha" ? "Nova senha" : "Senha"} id="senha" error={errors.password} hint={mode === "entrar" ? undefined : "Mínimo de 8 caracteres"}>
                  <Input
                    id="senha"
                    type="password"
                    autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "senha-error" : undefined}
                  />
                </Field>
              )}
              {mode === "entrar" && (
                <button type="button" onClick={() => go("recuperar")} className="justify-self-end text-sm font-semibold text-cz-gold-text underline-offset-2 hover:underline">
                  Esqueci minha senha
                </button>
              )}
              <Button type="submit" variant="brand" size="lg" loading={loading}>
                {mode === "entrar" ? "Entrar" : mode === "cadastro" ? "Criar conta" : mode === "recuperar" ? "Enviar link" : "Salvar nova senha"}
              </Button>
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
