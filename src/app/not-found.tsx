import Link from "next/link";
import { BrandLogo, SaasSurface } from "@/components/brand-switcher";

export const metadata = { title: "Página não encontrada", robots: { index: false, follow: false } };

/** 404 global: loja inexistente, link quebrado ou endereço digitado errado. */
export default function NotFound() {
  return (
    <SaasSurface className="grid place-items-center p-6">
      <main id="conteudo" className="grid max-w-md justify-items-center gap-4 text-center">
        <BrandLogo variant="symbol" height={56} />
        <h1 className="cz-heading text-2xl font-bold">Página não encontrada</h1>
        <p className="text-cz-muted">O endereço pode ter mudado ou a loja não está mais no ar. Confira o link que você recebeu.</p>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-[10px] bg-brand px-4 font-semibold text-brand-ink">
          Ir para o início
        </Link>
      </main>
    </SaasSurface>
  );
}
