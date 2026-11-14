import type { GatewayId } from "@/lib/types";
import type { PaymentGateway } from "../types";

const cents = (v: number) => Math.round(v * 100);
const bearer = (k: string) => ({ Authorization: `Bearer ${k || "<TOKEN_DO_LOJISTA>"}`, "Content-Type": "application/json" });
type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const infinitepay: PaymentGateway = {
  id: "infinitepay",
  label: "InfinitePay",
  methods: ["pix", "cartao_credito", "cartao_debito", "link"],
  features: ["Checkout Link", "Pix instantâneo", "InfiniteTap / Maquininha Smart"],
  docs: "https://www.infinitepay.io/checkout",
  buildCharge: (i, handle) => ({
    method: "POST",
    url: "https://api.infinitepay.io/invoices/public/checkout/links",
    headers: { "Content-Type": "application/json" },
    body: {
      handle: handle || "<infinitetag>",
      order_nsu: i.orderId,
      redirect_url: i.webhookUrl.replace("/api/webhooks/pagamentos", "/obrigado"),
      webhook_url: i.webhookUrl,
      items: [{ quantity: 1, price: cents(i.amount), description: i.description.slice(0, 120) }],
      customer: { name: i.customer.name, phone_number: `+${i.customer.phone}` },
    },
  }),
  sampleWebhook: (id, amount) => ({ invoice_slug: id, order_nsu: id, amount: cents(amount), paid_amount: cents(amount), capture_method: "pix", transaction_nsu: crypto.randomUUID() }),
  parseWebhook: (b) => {
    const x = b as Raw;
    return x?.order_nsu ? { chargeId: String(x.order_nsu), status: x.paid_amount > 0 ? "paid" : "failed", raw: b } : null;
  },
};

export const asaas: PaymentGateway = {
  id: "asaas",
  label: "Asaas",
  methods: ["pix", "cartao_credito", "link"],
  features: ["Pix QR Code dinâmico", "Cobrança recorrente (clube de café)", "Link de pagamento"],
  docs: "https://docs.asaas.com",
  buildCharge: (i, key) => ({
    method: "POST",
    url: "https://api.asaas.com/v3/payments",
    headers: { access_token: key || "<ASAAS_API_KEY>", "Content-Type": "application/json" },
    body: {
      customer: "<id do cliente em /v3/customers>",
      billingType: i.method === "pix" ? "PIX" : i.method === "cartao_credito" ? "CREDIT_CARD" : "UNDEFINED",
      value: i.amount,
      dueDate: new Date().toISOString().slice(0, 10),
      description: i.description,
      externalReference: i.orderId,
    },
  }),
  sampleWebhook: (id, amount) => ({ event: "PAYMENT_RECEIVED", payment: { id: `pay_${id}`, externalReference: id, value: amount, billingType: "PIX", status: "RECEIVED" } }),
  parseWebhook: (b) => {
    const x = b as Raw;
    if (!x?.payment?.externalReference) return null;
    const status = /RECEIVED|CONFIRMED/.test(x.event) ? "paid" : /REFUND/.test(x.event) ? "refunded" : "failed";
    return { chargeId: String(x.payment.externalReference), status, raw: b };
  },
};

export const mercadopago: PaymentGateway = {
  id: "mercadopago",
  label: "Mercado Pago",
  methods: ["pix", "cartao_credito", "cartao_debito", "link"],
  features: ["Checkout Transparente Pix", "Point Smart (TEF)", "Checkout Pro"],
  docs: "https://www.mercadopago.com.br/developers",
  buildCharge: (i, token) => ({
    method: "POST",
    url: "https://api.mercadopago.com/v1/payments",
    headers: { ...bearer(token), "X-Idempotency-Key": i.orderId },
    body: {
      transaction_amount: i.amount,
      description: i.description,
      payment_method_id: "pix",
      external_reference: i.orderId,
      notification_url: i.webhookUrl,
      date_of_expiration: new Date(Date.now() + (i.expiresInSeconds ?? 900) * 1000).toISOString(),
      payer: { email: i.customer.email || "cliente@exemplo.com.br", first_name: i.customer.name.split(" ")[0] },
    },
  }),
  sampleWebhook: (id) => ({ action: "payment.updated", type: "payment", data: { id: `mp_${id}` }, external_reference: id, status: "approved" }),
  parseWebhook: (b) => {
    const x = b as Raw;
    return x?.external_reference ? { chargeId: String(x.external_reference), status: x.status === "approved" ? "paid" : x.status === "refunded" ? "refunded" : "failed", raw: b } : null;
  },
};

export const pagbank: PaymentGateway = {
  id: "pagbank",
  label: "PagSeguro / PagBank",
  methods: ["pix", "cartao_credito", "cartao_debito"],
  features: ["Pix", "Cartão", "PlugPag (maquininha)"],
  docs: "https://dev.pagbank.uol.com.br",
  buildCharge: (i, token) => ({
    method: "POST",
    url: "https://api.pagseguro.com/orders",
    headers: bearer(token),
    body: {
      reference_id: i.orderId,
      customer: { name: i.customer.name, phones: [{ country: "55", area: i.customer.phone.slice(2, 4), number: i.customer.phone.slice(4), type: "MOBILE" }] },
      items: [{ name: i.description.slice(0, 64), quantity: 1, unit_amount: cents(i.amount) }],
      qr_codes: [{ amount: { value: cents(i.amount) }, expiration_date: new Date(Date.now() + (i.expiresInSeconds ?? 900) * 1000).toISOString() }],
      notification_urls: [i.webhookUrl],
    },
  }),
  sampleWebhook: (id, amount) => ({ reference_id: id, charges: [{ status: "PAID", amount: { value: cents(amount) } }] }),
  parseWebhook: (b) => {
    const x = b as Raw;
    return x?.reference_id ? { chargeId: String(x.reference_id), status: x.charges?.[0]?.status === "PAID" ? "paid" : "failed", raw: b } : null;
  },
};

export const stone: PaymentGateway = {
  id: "stone",
  label: "Ton / Stone (Pagar.me v5)",
  methods: ["pix", "cartao_credito", "cartao_debito", "link"],
  features: ["Pagar.me API v5", "Stone Code", "Ton Link / Pix"],
  docs: "https://docs.pagar.me/reference",
  buildCharge: (i, key) => ({
    method: "POST",
    url: "https://api.pagar.me/core/v5/orders",
    headers: {
      Authorization: `Basic ${typeof btoa === "function" ? btoa(`${key || "<sk_...>"}:`) : "<base64(sk:)>"}`,
      "Content-Type": "application/json",
    },
    body: {
      code: i.orderId,
      items: [{ amount: cents(i.amount), description: i.description.slice(0, 64), quantity: 1, code: i.orderId }],
      customer: { name: i.customer.name, type: "individual", phones: { mobile_phone: { country_code: "55", area_code: i.customer.phone.slice(2, 4), number: i.customer.phone.slice(4) } } },
      payments: [{ payment_method: "pix", pix: { expires_in: i.expiresInSeconds ?? 900 } }],
    },
  }),
  sampleWebhook: (id, amount) => ({ type: "order.paid", data: { code: id, amount: cents(amount), status: "paid" } }),
  parseWebhook: (b) => {
    const x = b as Raw;
    return x?.data?.code ? { chargeId: String(x.data.code), status: x.type === "order.paid" ? "paid" : "failed", raw: b } : null;
  },
};

export const presencial: PaymentGateway = {
  id: "presencial",
  label: "Presencial / na entrega",
  methods: ["dinheiro", "cartao_credito", "cartao_debito", "vale_refeicao"],
  features: ["Dinheiro com troco", "Cartão na maquininha", "Vale-refeição (Alelo, Pluxee, VR, Ticket)"],
  docs: "",
  buildCharge: (i) => ({ method: "POST", url: "(sem chamada externa: cobrado no balcão ou na entrega)", headers: {}, body: { orderId: i.orderId, amount: i.amount, method: i.method } }),
  sampleWebhook: (id, amount) => ({ orderId: id, amount, confirmedBy: "atendente" }),
  parseWebhook: (b) => {
    const x = b as Raw;
    return x?.orderId ? { chargeId: String(x.orderId), status: "paid", raw: b } : null;
  },
};

export const GATEWAYS: Record<GatewayId, PaymentGateway> = { infinitepay, asaas, mercadopago, pagbank, stone, presencial };
