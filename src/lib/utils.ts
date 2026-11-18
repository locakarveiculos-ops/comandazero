import type { CartItem, OpeningHour, Order, OrderStatus, Tenant } from "./types";

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (v: number) => brl.format(Number.isFinite(v) ? v : 0);

export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export const uid = (prefix = "") =>
  prefix + (globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 12) ?? Math.random().toString(36).slice(2, 14));

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function formatPhone(v: string) {
  const d = onlyDigits(v).replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Normaliza para 55 + DDD + número, formato usado pelo WhatsApp.
export function toWhatsappNumber(v: string) {
  const d = onlyDigits(v);
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

export const isValidBrPhone = (v: string) => /^55\d{10,11}$/.test(toWhatsappNumber(v));

export const formatCep = (v: string) => {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export const itemTotal = (it: Pick<CartItem, "unitPrice" | "qty">) => round2(it.unitPrice * it.qty);
export const cartSubtotal = (items: Pick<CartItem, "unitPrice" | "qty">[]) => round2(items.reduce((s, it) => s + itemTotal(it), 0));

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// Horário de Brasília independente do fuso do dispositivo.
export function brNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Saudação pelo horário de Brasília: bom dia 5h–11h59, boa tarde 12h–17h59, boa noite 18h–4h59. */
export function greeting(date = new Date()) {
  const h = Math.floor(brNow(date).minutes / 60);
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

export function isOpenNow(hours: OpeningHour[], date = new Date()) {
  const { day, minutes } = brNow(date);
  return hours.some((h) => {
    const open = toMinutes(h.open);
    const close = toMinutes(h.close);
    if (close > open) return h.day === day && minutes >= open && minutes < close;
    // Turno que atravessa a meia-noite.
    return (h.day === day && minutes >= open) || (h.day === (day + 6) % 7 && minutes < close);
  });
}

export function todayHours(tenant: Pick<Tenant, "hours">, date = new Date()) {
  const { day } = brNow(date);
  const h = tenant.hours.find((x) => x.day === day);
  return h ? `${h.open} às ${h.close}` : "Fechado hoje";
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  recebido: "Recebido",
  preparo: "Na cozinha",
  pronto: "Pronto",
  saiu: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const MODE_LABEL: Record<Order["mode"], string> = {
  delivery: "Delivery",
  retirada: "Retirada",
  mesa: "Mesa",
  encomenda: "Encomenda",
  balcao: "Balcão",
};

export const elapsedMinutes = (iso: string, now = Date.now()) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));

export function waitLevel(minutes: number): "ok" | "warn" | "late" {
  if (minutes < 10) return "ok";
  if (minutes < 20) return "warn";
  return "late";
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

export const fillTemplate = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));

export const slugify = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/**
 * slugify enquanto a pessoa digita: mantém o hífen do fim ("burger-" vira "burger-", não "burger"),
 * senão o hífen some a cada tecla e "burger-station" vira "burgerstation" (QA-04). Limpar no fim com slugify.
 */
export const slugifyTyping = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40);

// Contraste WCAG para validar cores escolhidas pelo lojista.
function luminance(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}

export const readableInk = (bg: string) => (contrastRatio(bg, "#FFFFFF") >= contrastRatio(bg, "#111111") ? "#FFFFFF" : "#111111");
