import { AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import type { SubscriptionState } from "@/lib/server/subscription";
import { READ_ONLY_AFTER_DAYS } from "@/lib/plans";

/**
 * Aviso fixo no topo do painel: teste grátis, atraso ou modo só leitura.
 * cta: "link" = botão para Assinatura; "none" = já está na tela de Assinatura (o dono não precisa de recado);
 * "ask-owner" = equipe sem permissão de pagar (QA-19).
 */
export function BillingBanner({ slug, sub, cta: mode }: { slug: string; sub: SubscriptionState | null; cta: "link" | "none" | "ask-owner" }) {
  if (!sub || sub.status === "active") return null;
  const href = `/painel/${slug}/assinatura`;
  const cta =
    mode === "link" ? (
      <Link href={href} className="inline-flex min-h-11 items-center rounded-[10px] bg-cz-navy px-4 text-sm font-semibold text-white">
        {sub.readOnly ? "Regularizar agora" : "Escolher plano"}
      </Link>
    ) : mode === "ask-owner" ? (
      <span className="text-sm">Avise o dono da loja.</span>
    ) : null;

  if (sub.readOnly)
    return (
      <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-[#e8b4b4] bg-[#fbeaea] p-4 text-[#7a1f1f]">
        <AlertTriangle className="size-5 shrink-0" aria-hidden />
        <p className="flex-1 text-sm">
          <b>Painel em modo só leitura.</b> {sub.status === "trial" ? "O teste grátis terminou." : sub.status === "canceled" ? "A assinatura foi cancelada." : `O pagamento está atrasado há mais de ${READ_ONLY_AFTER_DAYS} dias.`} Os pedidos continuam chegando, mas o cardápio e as configurações ficam travados.
        </p>
        {cta}
      </div>
    );

  if (sub.status === "overdue")
    return (
      <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-[#ecc98f] bg-[#fbf1df] p-4 text-[#6b3d0a]">
        <AlertTriangle className="size-5 shrink-0" aria-hidden />
        <p className="flex-1 text-sm">
          <b>Pagamento pendente.</b> Regularize em até {READ_ONLY_AFTER_DAYS} dias após o vencimento para não travar as edições.
        </p>
        {cta}
      </div>
    );

  const left = sub.trialDaysLeft ?? 0;
  return (
    <div role="status" data-testid="aviso-teste" className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-cz-border bg-cz-surface p-4">
      <Clock className="size-5 shrink-0 text-cz-gold-text" aria-hidden />
      <p className="flex-1 text-sm">
        <b>Teste grátis:</b> {left <= 0 ? "termina hoje" : `${left} dia${left === 1 ? "" : "s"} restante${left === 1 ? "" : "s"}`}. Escolha um plano para a loja continuar no ar depois.
      </p>
      {cta}
    </div>
  );
}
