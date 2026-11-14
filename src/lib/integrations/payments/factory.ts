import type { GatewayId, IntegrationSettings } from "@/lib/types";
import { buildPixPayload } from "@/lib/pix";
import { GATEWAYS } from "./adapters";
import type { ChargeInput, ChargeResult, PaymentGateway } from "./types";

export { GATEWAYS };

export function getGateway(id: GatewayId): PaymentGateway {
  const g = GATEWAYS[id];
  if (!g) throw new Error(`Gateway desconhecido: ${id}`);
  return g;
}

/** Escolhe o gateway configurado pela loja para o método escolhido no checkout. */
export function gatewayFor(settings: IntegrationSettings | undefined, method: ChargeInput["method"]): GatewayId {
  if (!settings) return method === "pix" ? "asaas" : "presencial";
  const enabled = (id: GatewayId) => settings.payments.gateways[id]?.enabled;
  if (method === "pix" && enabled(settings.payments.pixGateway)) return settings.payments.pixGateway;
  if (method === "link" && enabled(settings.payments.cardGateway)) return settings.payments.cardGateway;
  if (method === "dinheiro" || method === "vale_refeicao" || method.startsWith("cartao")) return "presencial";
  return (Object.keys(settings.payments.gateways) as GatewayId[]).find((id) => id !== "presencial" && enabled(id)) ?? "presencial";
}

/**
 * Fase 1 (sandbox): monta a requisição real do gateway para o testador e gera um Pix BR Code válido
 * (com CRC16) para o QR Code. Na Fase 2 o servidor envia a requisição e usa o copia-e-cola devolvido pelo gateway.
 */
export function createSandboxCharge(id: GatewayId, input: ChargeInput, opts: { pixKey: string; merchant: string; city: string }): ChargeResult {
  const gateway = getGateway(id);
  const chargeId = input.orderId;
  const expiresAt = new Date(Date.now() + (input.expiresInSeconds ?? 900) * 1000).toISOString();
  return {
    gateway: id,
    chargeId,
    status: "pending",
    request: gateway.buildCharge(input, ""),
    pix:
      input.method === "pix"
        ? {
            copyPaste: buildPixPayload({ key: opts.pixKey, name: opts.merchant, city: opts.city, amount: input.amount, txid: chargeId }),
            expiresAt,
          }
        : undefined,
    checkoutUrl: input.method === "link" ? `https://checkout.sandbox/${id}/${chargeId}` : undefined,
  };
}
