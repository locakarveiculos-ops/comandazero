// Robô de atendimento da loja no WhatsApp (puro e testável). Recebe o evento e devolve o card de resposta.
import type { Category, Product, Tenant } from "@/lib/types";
import { money } from "@/lib/utils";
import { numberedCard, type Card, type Incoming } from "./card";

export type BotCatalog = { tenant: Pick<Tenant, "name" | "slug" | "address" | "hours" | "whatsapp">; categories: Category[]; products: Product[] };
export type BotReply = { card: Card; options: string[]; handoff?: boolean };

const storeUrl = (appUrl: string, slug: string) => `${appUrl.replace(/\/+$/, "")}/loja/${slug}`;

export function welcome(cat: BotCatalog, appUrl: string, intro?: string): BotReply {
  const { card, ids } = numberedCard(
    `${intro ? `${intro}\n\n` : ""}Olá! Aqui é a *${cat.tenant.name}* 🌸\nComo podemos ajudar?`,
    [
      { id: "menu:cardapio", title: "Ver cardápio", description: "Categorias e preços" },
      { id: "menu:pedir", title: "Fazer pedido", description: "Link do nosso app" },
      { id: "menu:endereco", title: "Endereço e horário" },
      { id: "menu:atendente", title: "Falar com atendente" },
    ],
    true,
    "Abrir menu",
  );
  card.text += `\n\nPeça pelo app: ${storeUrl(appUrl, cat.tenant.slug)}`;
  return { card, options: ids };
}

export function respond(cat: BotCatalog, ev: Incoming, appUrl: string): BotReply | null {
  const url = storeUrl(appUrl, cat.tenant.slug);
  if (ev.kind === "ignored") return null;

  if (ev.kind === "location")
    return {
      card: { text: `📍 Localização recebida, obrigado! Vamos usar para calcular a entrega. Finalize por aqui: ${url}` },
      options: [],
    };

  if (ev.kind === "media") return { card: { text: "Recebemos seu arquivo. Um atendente vai conferir e responder em instantes. 💛" }, options: [], handoff: true };

  if (ev.kind === "text") {
    if (/atendente|humano|pessoa/i.test(ev.text)) return respond(cat, { kind: "action", id: "menu:atendente" }, appUrl);
    if (/card[aá]pio|menu/i.test(ev.text)) return respond(cat, { kind: "action", id: "menu:cardapio" }, appUrl);
    return welcome(cat, appUrl);
  }

  const id = ev.id;
  if (id === "menu:cardapio") {
    const cats = cat.categories.filter((c) => cat.products.some((p) => p.categoryId === c.id && p.available));
    const { card, ids } = numberedCard(
      "Escolha uma categoria do nosso cardápio:",
      cats.map((c) => ({ id: `cat:${c.id}`, title: c.name })),
      true,
      "Ver categorias",
    );
    return { card, options: ids };
  }
  if (id.startsWith("cat:")) {
    const c = cat.categories.find((x) => x.id === id.slice(4));
    const items = cat.products.filter((p) => p.categoryId === c?.id && p.available).slice(0, 10);
    if (!c || !items.length) return welcome(cat, appUrl, "Essa categoria está sem itens agora.");
    const { card, ids } = numberedCard(
      `*${c.name}*`,
      items.map((p) => ({ id: `prod:${p.id}`, title: p.name, description: p.priceLabel ?? money(p.price) })),
      true,
      "Ver itens",
    );
    return { card, options: ids };
  }
  if (id.startsWith("prod:")) {
    const p = cat.products.find((x) => x.id === id.slice(5));
    if (!p) return welcome(cat, appUrl);
    const { card, ids } = numberedCard(
      `*${p.name}* · ${p.priceLabel ?? money(p.price)}\n${p.description}\n\nPeça agora: ${url}?item=${p.id}`,
      [
        { id: "menu:pedir", title: "Quero pedir" },
        { id: "menu:cardapio", title: "Voltar ao cardápio" },
        { id: "menu:atendente", title: "Falar com atendente" },
      ],
    );
    return { card, options: ids };
  }
  if (id === "menu:pedir") return { card: { text: `🛍️ Monte seu pedido pelo nosso app (dá para instalar no celular): ${url}` }, options: [] };
  if (id === "menu:endereco") {
    const a = cat.tenant.address;
    return {
      card: {
        text: `📍 ${a.complement ? `${a.complement}\n` : ""}${a.street} · ${a.district}\n${a.city}-${a.uf} · CEP ${a.cep}\n\n🕗 Horários: ${summarizeHours(cat.tenant.hours)}`,
      },
      options: [],
    };
  }
  if (id === "menu:atendente")
    return { card: { text: "👩‍🍳 Certo! Um atendente vai continuar a conversa por aqui em instantes." }, options: [], handoff: true };
  if (id.startsWith("ok:")) return { card: { text: "✅ Pedido confirmado! Obrigado. Avisaremos cada etapa por aqui." }, options: [] };
  if (id.startsWith("loc:"))
    return { card: { text: "📍 Toque no clipe (📎) › Localização › Enviar sua localização atual." }, options: [] };
  return welcome(cat, appUrl);
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function summarizeHours(hours: Tenant["hours"]) {
  if (!hours.length) return "consulte a loja";
  const same = hours.length === 7 && hours.every((h) => h.open === hours[0].open && h.close === hours[0].close);
  if (same) return `todos os dias, ${hours[0].open} às ${hours[0].close}`;
  return [...hours]
    .sort((a, b) => a.day - b.day)
    .map((h) => `${DAYS[h.day]} ${h.open}–${h.close}`)
    .join(" · ");
}

/** Card enviado quando o pedido chega: botões de confirmação, localização e atendente. */
export function orderReceivedCard(text: string, orderId: string, withLocation: boolean) {
  return numberedCard(text, [
    { id: `ok:${orderId}`, title: "✅ Confirmar pedido" },
    ...(withLocation ? [{ id: `loc:${orderId}`, title: "📍 Enviar localização" }] : []),
    { id: "menu:atendente", title: "👩‍🍳 Falar c/ atendente" },
  ]);
}
