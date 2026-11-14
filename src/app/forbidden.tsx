import Link from "next/link";
import { BrandLogo, SaasSurface } from "@/components/brand-switcher";

export default function Forbidden() {
  return (
    <SaasSurface className="grid place-items-center p-6">
      <main id="conteudo" className="grid max-w-md justify-items-center gap-4 text-center">
        <BrandLogo variant="symbol" height={56} />
        <h1 className="cz-heading text-2xl font-bold">Acesso não permitido</h1>
        <p className="text-cz-muted">Sua conta não tem permissão para esta área. Peça ao dono da loja para liberar o seu acesso.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/painel" className="inline-flex min-h-11 items-center rounded-[10px] bg-brand px-4 font-semibold text-brand-ink">
            Ir para o meu painel
          </Link>
          <Link href="/entrar" className="inline-flex min-h-11 items-center rounded-[10px] border border-cz-border px-4 font-semibold">
            Trocar de conta
          </Link>
        </div>
      </main>
    </SaasSurface>
  );
}
