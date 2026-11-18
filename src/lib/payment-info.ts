import { buildPixPayload } from "./pix";
import type { Order, PaymentMethod } from "./types";
import { money, round2 } from "./utils";

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  dinheiro: "Dinheiro",
  vale_refeicao: "Vale-refeição",
  link: "Link de pagamento",
};

/** Troco a levar: "troco para R$ 50" num pedido de R$ 38,40 = R$ 11,60. Sem troco pedido (ou valor menor), 0. */
export const changeToBring = (o: Pick<Order, "changeFor" | "total">) => (o.changeFor && o.changeFor > o.total ? round2(o.changeFor - o.total) : 0);

/** Linha de pagamento do cartão do pedido no painel (QA-03): forma + troco quando houver. */
export function paymentSummary(o: Pick<Order, "paymentMethod" | "changeFor" | "total">) {
  const label = PAYMENT_LABEL[o.paymentMethod] ?? "Pagamento";
  const change = o.paymentMethod === "dinheiro" ? changeToBring(o) : 0;
  return change ? `${label} · troco para ${money(o.changeFor!)} (levar ${money(change)})` : label;
}

export type TrackingPayment =
  | { kind: "pix"; payload: string; key: string; name: string; amount: number }
  | { kind: "pix_sem_chave" }
  | { kind: "pago" }
  | { kind: "na_entrega"; label: string; change: number };

/**
 * O que a página de acompanhamento mostra sobre pagamento (QA-01 e QA-02).
 * Pix pendente com chave da loja: QR + copia-e-cola com o valor a pagar agora (sinal, se encomenda).
 * Dinheiro/cartão: nada de "aguardando Pix" — o pagamento é na entrega ou na retirada.
 */
export function trackingPayment(
  o: Pick<Order, "paymentMethod" | "paymentStatus" | "total" | "deposit" | "changeFor" | "number">,
  pix: { key: string; name: string; city: string } | null | undefined,
): TrackingPayment {
  if (o.paymentStatus === "pago") return { kind: "pago" };
  if (o.paymentMethod !== "pix") return { kind: "na_entrega", label: PAYMENT_LABEL[o.paymentMethod] ?? "Pagamento", change: o.paymentMethod === "dinheiro" ? changeToBring(o) : 0 };
  if (!pix?.key) return { kind: "pix_sem_chave" };
  const amount = o.paymentStatus === "parcial" ? round2(o.total - (o.deposit ?? 0)) : (o.deposit ?? o.total);
  return { kind: "pix", key: pix.key, name: pix.name, amount, payload: buildPixPayload({ key: pix.key, name: pix.name, city: pix.city, amount, txid: `PED${o.number}` }) };
}
