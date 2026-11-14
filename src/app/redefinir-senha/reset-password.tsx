"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
import { BrandLogo, SaasSurface, useSaasTheme } from "@/components/brand-switcher";
import { Button, Field } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { authErrorPt } from "@/lib/auth-errors";

/** Nova senha após o link de recuperação (a sessão temporária vem do /auth/callback). */
export function ResetPassword() {
  const dark = useSaasTheme() === "dark";
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSupabase()
      ?.auth.getUser()
      .then(({ data }) => setReady(!!data.user));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Mínimo de 8 caracteres");
    if (password !== confirm) return setError("As senhas não conferem");
    setError("");
    setLoading(true);
    const { error: err } = await getSupabase()!.auth.updateUser({ password });
    setLoading(false);
    if (err) return toast.error(authErrorPt(err.message));
    toast.success("Senha atualizada");
    window.location.assign(new URL("/painel", window.location.origin).href);
  };

  return (
    <SaasSurface className="grid place-items-center px-4 py-10">
      <main id="conteudo" className="w-full max-w-sm">
        <BrandLogo variant="vertical-slogan" height={110} onDark={dark} className="mx-auto mb-8" />
        <h1 className="cz-heading text-3xl font-bold">Definir nova senha</h1>
        {ready === false ? (
          <div role="status" className="mt-6 rounded-[14px] border border-cz-border bg-cz-surface p-5">
            <p className="font-semibold">Link vencido ou já usado</p>
            <p className="mt-1 text-sm text-cz-muted">Peça um novo link de recuperação. Ele vale por 1 hora.</p>
            <Link href="/entrar?modo=recuperar" className="mt-4 inline-flex min-h-11 items-center rounded-[10px] bg-brand px-4 font-semibold text-brand-ink">
              Pedir novo link
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-6 grid gap-4">
            <Field label="Nova senha" id="senha" error={error} hint="Mínimo de 8 caracteres">
              <PasswordInput id="senha" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} showStrength aria-invalid={!!error} aria-describedby={error ? "senha-error" : "senha-hint"} />
            </Field>
            <Field label="Repita a nova senha" id="senha2">
              <PasswordInput id="senha2" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <Button type="submit" variant="brand" size="lg" loading={loading} disabled={ready === null}>
              Salvar nova senha
            </Button>
          </form>
        )}
      </main>
    </SaasSurface>
  );
}
