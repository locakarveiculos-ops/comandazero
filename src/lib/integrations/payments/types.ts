import type { GatewayId, PaymentMethod } from "@/lib/types";

export type ChargeInput = {
  orderId: string;
  amount: number;
  description: string;
  method: PaymentMethod;
  customer: { name: string; phone: string; email?: string };
  webhookUrl: string;
  expiresInSeconds?: number;
};

/** Requisição HTTP que o servidor faria ao gateway (exibida no testador de payload). */
export type GatewayRequest = { method: "POST" | "GET"; url: string; headers: Record<string, string>; body?: unknown };

export type ChargeResult = {
  gateway: GatewayId;
  chargeId: string;
  status: "pending" | "paid";
  pix?: { copyPaste: string; expiresAt: string };
  checkoutUrl?: string;
  request: GatewayRequest;
};

export type WebhookEvent = { chargeId: string; status: "paid" | "failed" | "refunded"; raw: unknown };

export interface PaymentGateway {
  id: GatewayId;
  label: string;
  methods: PaymentMethod[];
  features: string[];
  docs: string;
  /** Monta a requisição de cobrança no formato oficial do gateway. */
  buildCharge(input: ChargeInput, credential: string): GatewayRequest;
  /** Exemplo do webhook de confirmação que o gateway envia (para simulação e testes). */
  sampleWebhook(chargeId: string, amount: number): unknown;
  /** Lê o webhook do gateway e devolve o status normalizado. */
  parseWebhook(body: unknown): WebhookEvent | null;
}
