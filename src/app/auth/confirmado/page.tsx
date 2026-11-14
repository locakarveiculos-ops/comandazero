import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SaasSurface } from "@/components/brand-switcher";
import { getUser } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "E-mail confirmado", robots: { index: false, follow: false } };

/** Depois do link de confirmação: conta ativa; segue para criar a loja ou para o painel. */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/entrar");
  const sb = await supabaseServer();
  const { data } = await sb.rpc("my_tenants");
  const hasStore = ((data ?? []) as unknown[]).length > 0;

  return (
    <SaasSurface className="grid place-items-center p-6">
      <main id="conteudo" className="grid max-w-md justify-items-center gap-4 text-center">
        <CheckCircle2 className="size-14 text-cz-success" aria-hidden />
        <h1 className="cz-heading text-2xl font-bold">E-mail confirmado</h1>
        <p className="text-cz-muted">
          Tudo certo, <b>{user.email}</b>. {hasStore ? "Sua conta já está ligada a uma loja." : "Agora falta só cadastrar a sua loja: leva uns 3 minutos."}
        </p>
        <Link href={hasStore ? "/painel" : "/onboarding"} className="inline-flex min-h-12 items-center rounded-[10px] bg-brand px-6 font-semibold text-brand-ink">
          {hasStore ? "Ir para o painel" : "Criar minha loja"}
        </Link>
      </main>
    </SaasSurface>
  );
}
