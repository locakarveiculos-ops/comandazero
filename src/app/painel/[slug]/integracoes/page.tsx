"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useOrigin } from "@/lib/use-client";
import { CreditCard, Mail, MessageCircle, Send } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useStoreTenant } from "@/components/loja/use-store-tenant";
import { WhatsappConnect } from "@/components/painel/whatsapp-connect";
import { Badge, Button, Card, Field, Input, Select, Switch, Textarea } from "@/components/ui";
import { ROOT_DOMAIN } from "@/config/saas-brand";
import { cakeConfirmationEmail, dailyCloseEmail, orderReceiptEmail, welcomeTenantEmail } from "@/lib/integrations/email/templates";
import { buildSendRequest, dnsRecordsFor, fromAddress, tenantEmailDomain } from "@/lib/integrations/email/resend";
import { GATEWAYS } from "@/lib/integrations/payments/factory";
import { evolution } from "@/lib/integrations/whatsapp/evolution";
import { numberedCard } from "@/lib/integrations/whatsapp/card";
import { welcome } from "@/lib/integrations/whatsapp/bot";
import { buildOrderCard, readChannelBlob } from "@/lib/integrations/whatsapp/notify";
import { updateIntegrations, useIntegrations, useMenu, useOrders } from "@/lib/repositories";
import { isRemote } from "@/lib/repositories/engine";
import { useRemoteIntegrations } from "@/lib/repositories/remote";
import { usePanelAccess } from "../panel-shell";
import { hasFeature } from "@/lib/plans";
import type { GatewayId, IntegrationSettings, Order, WhatsappTrigger } from "@/lib/types";
import { cn, formatPhone, isValidBrPhone, money, round2, toWhatsappNumber } from "@/lib/utils";

const TRIGGERS: { id: WhatsappTrigger; label: string }[] = [
  { id: "recebido", label: "Pedido recebido (com botões)" },
  { id: "preparo", label: "Entrou em preparo" },
  { id: "pronto", label: "Pronto no balcão" },
  { id: "saiu", label: "Saiu para entrega" },
  { id: "pos_venda", label: "Pós-venda / pesquisa" },
];

const SAMPLE_PICKUP = new Date(Date.UTC(2026, 11, 20, 19, 0)).toISOString();

const tabCls = "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold data-[state=active]:bg-brand data-[state=active]:text-brand-ink data-[state=inactive]:bg-cz-surface data-[state=inactive]:ring-1 data-[state=inactive]:ring-cz-border inline-flex items-center gap-2";

export default function IntegracoesPage() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant } = useStoreTenant(slug);
  const remote = isRemote(tenant);
  const local = useIntegrations(remote ? undefined : tenant?.id);
  const r = useRemoteIntegrations(tenant?.id, remote);
  // Loja real: configurações no banco. Demonstração: no navegador.
  const settings = remote ? r.settings : local;
  if (!tenant) return null;
  if (!settings) return <p className="text-sm text-cz-muted">Carregando integrações…</p>;
  const set = remote ? r.update : (fn: (s: IntegrationSettings) => IntegrationSettings) => updateIntegrations(tenant.id, fn);

  return (
    <div className="grid min-w-0 gap-5">
      <div>
        <h1 className="cz-heading text-2xl font-bold">Integrações</h1>
        <p className="text-sm text-cz-muted">WhatsApp com botões e listas, gateways de pagamento e e-mail transacional, com testador de payload ao vivo.</p>
      </div>
      <Tabs.Root defaultValue="whatsapp" className="grid min-w-0 gap-5">
        <Tabs.List className="no-scrollbar flex gap-2 overflow-x-auto" aria-label="Integrações" data-tour="integ-abas">
          <Tabs.Trigger value="whatsapp" className={tabCls}>
            <MessageCircle className="size-4" aria-hidden /> WhatsApp
          </Tabs.Trigger>
          <Tabs.Trigger value="pagamentos" className={tabCls}>
            <CreditCard className="size-4" aria-hidden /> Pagamentos
          </Tabs.Trigger>
          <Tabs.Trigger value="email" className={tabCls}>
            <Mail className="size-4" aria-hidden /> E-mail (Resend)
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="whatsapp">
          <WhatsappTab settings={settings} set={set} />
        </Tabs.Content>
        <Tabs.Content value="pagamentos">
          <PaymentsTab settings={settings} set={set} />
        </Tabs.Content>
        <Tabs.Content value="email">
          <EmailTab settings={settings} set={set} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

type TabProps = { settings: IntegrationSettings; set: (fn: (s: IntegrationSettings) => IntegrationSettings) => void };

function useTenantCtx() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant } = useStoreTenant(slug);
  const orders = useOrders(tenant?.id);
  return { tenant: tenant!, sample: orders[0] };
}

function WhatsappTab({ settings, set }: TabProps) {
  // Teste grátis = plano completo; depois, WhatsApp a partir do Profissional.
  const { plan = "enterprise" } = usePanelAccess();
  const wa = hasFeature(plan, "whatsapp");
  const { tenant, sample } = useTenantCtx();
  const { categories, products } = useMenu(tenant.id);
  const w = settings.whatsapp;
  const [kind, setKind] = useState<"buttons" | "list" | "order" | "menu" | "evo-text" | "evo-media">("order");
  const [to, setTo] = useState(formatPhone(tenant.whatsapp));
  const [sending, setSending] = useState(false);
  const origin = useOrigin();

  const payload = useMemo(() => {
    const number = toWhatsappNumber(to);
    if (kind === "order" && sample) return buildOrderCard("recebido", sample, tenant, settings, origin);
    if (kind === "buttons")
      return numberedCard(`☕ ${tenant.name}: seu pedido está quase pronto. O que prefere?`, [
        { id: "ok:teste", title: "✅ Confirmar pedido" },
        { id: "loc:teste", title: "📍 Enviar localização" },
        { id: "menu:atendente", title: "👩‍🍳 Falar c/ atendente" },
      ]).card;
    if (kind === "list") {
      const cats = categories.filter((c) => products.some((p) => p.categoryId === c.id));
      return numberedCard("Escolha uma categoria do nosso cardápio:", cats.map((c) => ({ id: `cat:${c.id}`, title: c.name })), true, "Ver categorias").card;
    }
    if (kind === "menu") return welcome({ tenant, categories, products }, origin).card;
    if (kind === "evo-text") return evolution.sendText(w.evolution.instance || "minha-instancia", number, `Olá! Pedido recebido na ${tenant.name}.`);
    return evolution.sendMedia(w.evolution.instance || "minha-instancia", number, { url: products[0]?.image ?? "", caption: products[0]?.name });
  }, [kind, sample, tenant, settings, origin, categories, products, to, w.evolution.instance]);

  const isWhaileys = !kind.startsWith("evo");
  const send = async () => {
    if (!isValidBrPhone(to)) return toast.error("Telefone com DDD");
    if (!isWhaileys) return sendEvolution();
    const blob = readChannelBlob(tenant.slug);
    if (!blob) return toast.error("Conecte o WhatsApp da loja primeiro (acima).");
    setSending(true);
    try {
      const r = await fetch("/api/whatsapp/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: tenant.slug, blob, to, card: payload }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; messageId?: string };
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      toast.success(`Enviado! id ${d.messageId?.slice(0, 10)}…`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  // Evolution: a URL e a chave ficam no servidor; o painel só manda instância, destino e conteúdo.
  const sendEvolution = async () => {
    const body = (payload as { body: { text?: string; textMessage?: { text: string }; media?: string; mediaMessage?: { media: string; caption: string }; caption?: string } }).body;
    setSending(true);
    try {
      const r = await fetch("/api/whatsapp/evolution", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          kind === "evo-text"
            ? { op: "sendText", instance: w.evolution.instance || tenant.slug, to, text: body.text ?? body.textMessage?.text }
            : { op: "sendMedia", instance: w.evolution.instance || tenant.slug, to, url: body.media ?? body.mediaMessage?.media, caption: body.caption ?? body.mediaMessage?.caption },
        ),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      toast.success("Enviado pela Evolution API");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="grid min-w-0 content-start gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold">Provedor</h2>
          <Switch checked={w.enabled} onCheckedChange={(v) => set((s) => ({ ...s, whatsapp: { ...s.whatsapp, enabled: v } }))} label="WhatsApp ativo" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Provedor de WhatsApp">
          {(
            [
              ["whaileys", "Whaileys (botões e listas)", "Motor próprio · um número por loja"],
              ["evolution", "Evolution API v1/v2", "Texto, mídia, instância e webhooks"],
            ] as const
          ).map(([id, label, hint]) => (
            <button key={id} type="button" role="radio" aria-checked={w.provider === id} onClick={() => set((s) => ({ ...s, whatsapp: { ...s.whatsapp, provider: id } }))} className={cn("rounded-2xl border p-3 text-left", w.provider === id ? "border-cz-text bg-cz-surface-2" : "border-cz-border")}>
              <p className="text-sm font-bold">{label}</p>
              <p className="text-xs text-cz-muted">{hint}</p>
            </button>
          ))}
        </div>
        {w.provider === "whaileys" ? (
          <WhatsappConnect tenant={tenant} included={wa} />
        ) : (
          <div className="grid gap-3">
            <Field label="URL do servidor Evolution" id="evo-url">
              <Input id="evo-url" value={w.evolution.baseUrl} placeholder="https://evolution.suaempresa.com.br" onChange={(e) => set((s) => ({ ...s, whatsapp: { ...s.whatsapp, evolution: { ...s.whatsapp.evolution, baseUrl: e.target.value } } }))} />
            </Field>
            <Field label="Instância" id="evo-inst">
              <Input id="evo-inst" value={w.evolution.instance} placeholder={tenant.slug} onChange={(e) => set((s) => ({ ...s, whatsapp: { ...s.whatsapp, evolution: { ...s.whatsapp.evolution, instance: e.target.value } } }))} />
            </Field>
            <p className="rounded-xl bg-cz-surface-2 p-3 text-xs text-cz-muted">
              URL e API key ficam só no servidor (<code>EVOLUTION_API_URL</code>, <code>{w.evolution.apiKeyRef}</code>). Criar instância: <code>POST {evolution.createInstance(w.evolution.instance || tenant.slug, "…").path}</code> · QR: <code>GET {evolution.connect(w.evolution.instance || tenant.slug).path}</code>
            </p>
          </div>
        )}

        <h3 className="mt-2 font-bold">Gatilhos automáticos</h3>
        <ul className="grid gap-3">
          {TRIGGERS.map((t) => {
            const cfg = w.triggers[t.id];
            return (
              <li key={t.id} className="grid gap-2 rounded-2xl border border-cz-border p-3">
                <label className="flex min-h-11 items-center justify-between gap-2 text-sm font-semibold">
                  {t.label}
                  <Switch checked={cfg.enabled} onCheckedChange={(v) => set((s) => ({ ...s, whatsapp: { ...s.whatsapp, triggers: { ...s.whatsapp.triggers, [t.id]: { ...cfg, enabled: v } } } }))} label={t.label} />
                </label>
                <Textarea aria-label={`Mensagem: ${t.label}`} value={cfg.template} onChange={(e) => set((s) => ({ ...s, whatsapp: { ...s.whatsapp, triggers: { ...s.whatsapp.triggers, [t.id]: { ...cfg, template: e.target.value } } } }))} className="text-sm" />
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-cz-muted">
          Variáveis: <code>{"{cliente}"}</code> <code>{"{numero}"}</code> <code>{"{loja}"}</code> <code>{"{total}"}</code> <code>{"{link}"}</code>
        </p>
      </Card>

      <Card className="grid min-w-0 content-start gap-4">
        <h2 className="font-bold">Testador de payload ao vivo</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mensagem" id="pl-kind">
            <Select id="pl-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="order">Pedido recebido (botões)</option>
              <option value="buttons">sendButtons · 3 botões</option>
              <option value="list">sendList · categorias</option>
              <option value="menu">Menu do robô (lista)</option>
              <option value="evo-text">Evolution · sendText</option>
              <option value="evo-media">Evolution · sendMedia</option>
            </Select>
          </Field>
          <Field label="Enviar para" id="pl-to">
            <Input id="pl-to" inputMode="tel" value={to} onChange={(e) => setTo(formatPhone(e.target.value))} />
          </Field>
        </div>
        {isWhaileys && <ChatPreview card={payload as ReturnType<typeof numberedCard>["card"]} />}
        <div>
          <p className="mb-1 text-xs font-semibold text-cz-muted">{isWhaileys ? "POST /sessions/cpw-" + tenant.slug + "/send" : `${(payload as { method: string }).method} ${(payload as { path: string }).path}`}</p>
          <pre className="min-w-0 max-w-full whitespace-pre-wrap break-all max-h-72 overflow-auto rounded-xl bg-[#08162d] p-3 text-xs text-[#e3c58c]">{JSON.stringify(isWhaileys ? { to: toWhatsappNumber(to), ...payload } : (payload as { body: unknown }).body, null, 2)}</pre>
        </div>
        <Button variant="brand" onClick={send} loading={sending}>
          <Send className="size-4" aria-hidden /> {isWhaileys ? "Enviar de verdade pelo WhatsApp da loja" : "Enviar pela Evolution API"}
        </Button>
        {!isWhaileys && <p className="text-xs text-cz-muted">Usa EVOLUTION_API_URL e EVOLUTION_API_KEY do servidor. Sem elas, o envio informa que não está configurado.</p>}
      </Card>
    </div>
  );
}

function ChatPreview({ card }: { card: { text: string; buttons?: { id: string; title: string }[]; sections?: { rows: { id: string; title: string; description?: string }[] }[]; buttonText?: string } }) {
  return (
    <div className="rounded-2xl bg-[#e9ddd1] p-4" aria-label="Prévia da conversa no WhatsApp">
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white p-3 text-sm text-[#111b21] shadow-sm">
        <p className="whitespace-pre-wrap">{card.text}</p>
      </div>
      {card.buttons && (
        <div className="mt-1 grid max-w-[85%] gap-1">
          {card.buttons.map((b) => (
            <span key={b.id} className="rounded-xl bg-white py-2 text-center text-sm font-semibold text-[#1d4f85] shadow-sm">
              {b.title}
            </span>
          ))}
        </div>
      )}
      {card.sections && (
        <span className="mt-1 block max-w-[85%] rounded-xl bg-white py-2 text-center text-sm font-semibold text-[#1d4f85] shadow-sm">☰ {card.buttonText}</span>
      )}
    </div>
  );
}

function PaymentsTab({ settings, set }: TabProps) {
  const { tenant, sample } = useTenantCtx();
  const [gw, setGw] = useState<GatewayId>(settings.payments.pixGateway);
  const ids = Object.keys(GATEWAYS) as GatewayId[];
  const origin = useOrigin();
  const order: Order | undefined = sample;
  const amount = order?.total ?? 42.8;
  const input = {
    orderId: order?.id ?? "o_teste",
    amount,
    description: `Pedido #${order?.number ?? 1001} ${tenant.name}`,
    method: "pix" as const,
    customer: { name: order?.customer.name || "Cliente Teste", phone: order?.customer.phone || "5519999990000" },
    webhookUrl: `${origin}/api/webhooks/pagamentos/${gw}`,
  };
  const g = GATEWAYS[gw];
  const req = g.buildCharge(input, "");
  const hook = g.sampleWebhook(input.orderId, amount);
  const parsed = g.parseWebhook(hook);
  const cfg = settings.payments.gateways[gw];
  const setCfg = (patch: Partial<typeof cfg>) => set((s) => ({ ...s, payments: { ...s.payments, gateways: { ...s.payments.gateways, [gw]: { ...cfg, ...patch } } } }));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
      <Card className="grid min-w-0 content-start gap-3">
        <h2 className="font-bold">Gateways da loja</h2>
        <ul className="grid gap-2">
          {ids.map((id) => {
            const c = settings.payments.gateways[id];
            return (
              <li key={id}>
                <div className={cn("flex items-center gap-3 rounded-2xl border p-3", gw === id ? "border-cz-text bg-cz-surface-2" : "border-cz-border")}>
                  <button type="button" onClick={() => setGw(id)} className="min-h-11 flex-1 text-left" aria-pressed={gw === id}>
                    <p className="text-sm font-bold">{GATEWAYS[id].label}</p>
                    <p className="text-xs text-cz-muted">{GATEWAYS[id].features.join(" · ")}</p>
                  </button>
                  <Badge tone={c.enabled ? "green" : "neutral"}>{c.enabled ? c.mode : "off"}</Badge>
                  <Switch checked={c.enabled} onCheckedChange={(v) => set((s) => ({ ...s, payments: { ...s.payments, gateways: { ...s.payments.gateways, [id]: { ...c, enabled: v } } } }))} label={`${GATEWAYS[id].label} ativo`} />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pix pelo" id="pixgw">
            <Select id="pixgw" value={settings.payments.pixGateway} onChange={(e) => set((s) => ({ ...s, payments: { ...s.payments, pixGateway: e.target.value as GatewayId } }))}>
              {ids.filter((i) => GATEWAYS[i].methods.includes("pix")).map((i) => (
                <option key={i} value={i}>
                  {GATEWAYS[i].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Link/cartão online pelo" id="cardgw">
            <Select id="cardgw" value={settings.payments.cardGateway} onChange={(e) => set((s) => ({ ...s, payments: { ...s.payments, cardGateway: e.target.value as GatewayId } }))}>
              {ids.filter((i) => GATEWAYS[i].methods.includes("link")).map((i) => (
                <option key={i} value={i}>
                  {GATEWAYS[i].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="grid min-w-0 content-start gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">{g.label}</h2>
          {g.docs && (
            <a href={g.docs} target="_blank" rel="noopener" className="text-sm font-semibold text-cz-info underline">
              Documentação
            </a>
          )}
        </div>
        {gw !== "presencial" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Ambiente" id="gw-mode">
              <Select id="gw-mode" value={cfg.mode} onChange={(e) => setCfg({ mode: e.target.value as "sandbox" | "producao" })}>
                <option value="sandbox">Sandbox</option>
                <option value="producao">Produção</option>
              </Select>
            </Field>
            <Field label="Credencial (variável no servidor)" id="gw-key" hint="Nunca salve a chave no navegador.">
              <Input id="gw-key" value={cfg.keyRef} onChange={(e) => setCfg({ keyRef: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} />
            </Field>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm font-semibold">
              <Switch checked={cfg.split} onCheckedChange={(v) => setCfg({ split: v })} label="Split com a plataforma" /> Split
            </label>
          </div>
        )}
        <p className="text-xs font-semibold text-cz-muted">
          1. Cobrança · {req.method} {req.url}
        </p>
        <pre className="min-w-0 max-w-full whitespace-pre-wrap break-all max-h-64 overflow-auto rounded-xl bg-[#08162d] p-3 text-xs text-[#e3c58c]">{JSON.stringify({ headers: req.headers, body: req.body }, null, 2)}</pre>
        <p className="text-xs font-semibold text-cz-muted">2. Webhook de confirmação recebido em {input.webhookUrl}</p>
        <pre className="min-w-0 max-w-full whitespace-pre-wrap break-all max-h-48 overflow-auto rounded-xl bg-[#08162d] p-3 text-xs text-[#9cc3f0]">{JSON.stringify(hook, null, 2)}</pre>
        <p className="rounded-xl bg-cz-success/10 p-3 text-sm text-cz-success">
          3. Normalizado: pedido <b>{parsed?.chargeId}</b> → <b>{parsed?.status === "paid" ? "PAGO" : parsed?.status}</b> · {money(amount)}
        </p>
      </Card>
    </div>
  );
}

function EmailTab({ settings, set }: TabProps) {
  const { tenant, sample } = useTenantCtx();
  const orders = useOrders(tenant.id);
  const e = settings.email;
  const domain = e.subdomain || tenantEmailDomain(tenant.subdomain, ROOT_DOMAIN);
  const [tpl, setTpl] = useState<"pedido" | "bolo" | "caixa" | "boas-vindas">("pedido");
  const origin = useOrigin();

  const email = useMemo(() => {
    const order = sample ?? orders[0];
    if (tpl === "pedido" && order) return orderReceiptEmail(order, tenant, `${origin}/loja/${tenant.slug}/pedido/${order.id}`);
    if (tpl === "bolo") {
      const cake = orders.find((o) => o.items.some((i) => i.cake?.kg));
      const demo: Order = cake ?? {
        ...(order as Order),
        mode: "encomenda",
        total: 224.75,
        deposit: 112.38,
        items: [{ key: "k", productId: "p_bolo_festa", name: "Bolo de festa", image: "", unitPrice: 224.75, qty: 1, options: [], notes: "", cake: { kg: 2.5, massa: "Branca de baunilha", recheio: "Morango com chantilly", cobertura: "Chantilly com morangos", frase: "Feliz aniversário, Ana!", pickupAt: SAMPLE_PICKUP } }],
      };
      return cakeConfirmationEmail(demo, tenant);
    }
    if (tpl === "caixa") {
      const today = orders.slice(0, 20);
      const revenue = round2(today.reduce((s, o) => s + o.total, 0));
      const byMethod = today.reduce<Record<string, number>>((acc, o) => ((acc[o.paymentMethod] = round2((acc[o.paymentMethod] ?? 0) + o.total)), acc), {});
      return dailyCloseEmail(tenant, { date: new Date().toLocaleDateString("pt-BR"), revenue, orders: today.length, avg: today.length ? round2(revenue / today.length) : 0, byMethod, top: [{ name: "Cappuccino Artesanal", qty: 18 }, { name: "Croissants Artesanais", qty: 11 }] });
    }
    return welcomeTenantEmail(tenant, `${origin}/painel/${tenant.slug}`, `${origin}/loja/${tenant.slug}`, origin);
  }, [tpl, sample, orders, tenant, origin]);

  const request = buildSendRequest({ from: fromAddress(e.fromName || tenant.name, domain), to: [e.ownerEmail || "cliente@exemplo.com.br"], subject: email.subject, html: "<…html do template…>" });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
      <Card className="grid min-w-0 content-start gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Resend</h2>
          <Switch checked={e.enabled} onCheckedChange={(v) => set((s) => ({ ...s, email: { ...s.email, enabled: v } }))} label="E-mail ativo" />
        </div>
        <p className="text-xs text-cz-muted">
          A chave fica no servidor (<code>RESEND_API_KEY</code>). Cada loja envia do próprio subdomínio verificado.
        </p>
        <Field label="Nome do remetente" id="em-name">
          <Input id="em-name" value={e.fromName} placeholder={tenant.name} onChange={(ev) => set((s) => ({ ...s, email: { ...s.email, fromName: ev.target.value } }))} />
        </Field>
        <Field label="Subdomínio de envio" id="em-sub">
          <Input id="em-sub" value={e.subdomain} placeholder={tenantEmailDomain(tenant.subdomain, ROOT_DOMAIN)} onChange={(ev) => set((s) => ({ ...s, email: { ...s.email, subdomain: ev.target.value.toLowerCase().trim(), verified: false } }))} />
        </Field>
        <Field label="E-mail do dono (fechamento de caixa)" id="em-owner">
          <Input id="em-owner" type="email" value={e.ownerEmail} onChange={(ev) => set((s) => ({ ...s, email: { ...s.email, ownerEmail: ev.target.value } }))} />
        </Field>
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            DNS para verificar <Badge tone={e.verified ? "green" : "amber"}>{e.verified ? "Verificado" : "Pendente"}</Badge>
          </p>
          <ul className="grid gap-1.5 text-xs">
            {dnsRecordsFor(domain).map((r) => (
              <li key={r.name + r.type} className="grid grid-cols-[44px_1fr] gap-2 rounded-lg bg-cz-surface-2 p-2 font-mono">
                <b>{r.type}</b>
                <span className="break-all">
                  {r.name}
                  <br />
                  <span className="text-cz-muted">{r.value}</span>
                </span>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              set((s) => ({ ...s, email: { ...s.email, verified: true } }));
              toast.success("Domínio marcado como verificado (sandbox)");
            }}
          >
            Verificar domínio
          </Button>
        </div>
      </Card>
      <Card className="grid min-w-0 content-start gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Prévia dos templates</h2>
          <Select aria-label="Template" value={tpl} onChange={(ev) => setTpl(ev.target.value as typeof tpl)} className="w-auto">
            <option value="pedido">Comprovante de pedido</option>
            <option value="bolo">Confirmação de encomenda</option>
            <option value="caixa">Fechamento de caixa</option>
            <option value="boas-vindas">Boas-vindas de tenant</option>
          </Select>
        </div>
        <p className="text-sm">
          <b>Assunto:</b> {email.subject}
        </p>
        <iframe title="Prévia do e-mail" srcDoc={email.html} sandbox="" className="h-[520px] w-full rounded-xl border border-cz-border bg-cz-surface" />
        <pre className="min-w-0 max-w-full whitespace-pre-wrap break-all max-h-40 overflow-auto rounded-xl bg-[#08162d] p-3 text-xs text-[#e3c58c]">{JSON.stringify({ url: request.url, body: { ...request.body } }, null, 2)}</pre>
      </Card>
    </div>
  );
}
