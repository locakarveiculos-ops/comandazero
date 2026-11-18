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
import { cakeConfirmationEmail, dailyCloseEmail, orderReceiptEmail, welcomeTenantEmail } from "@/lib/integrations/email/templates";
import { buildSendRequest, fromAddress } from "@/lib/integrations/email/resend";
import { GATEWAYS } from "@/lib/integrations/payments/factory";
import { evolution, evolutionInstanceName } from "@/lib/integrations/whatsapp/evolution";
import { EvolutionConnect } from "@/components/painel/evolution-connect";
import { numberedCard } from "@/lib/integrations/whatsapp/card";
import { welcome } from "@/lib/integrations/whatsapp/bot";
import { buildOrderCard, readChannelBlob } from "@/lib/integrations/whatsapp/notify";
import { updateIntegrations, useIntegrations, useMenu, useOrders } from "@/lib/repositories";
import { isRemote } from "@/lib/repositories/engine";
import { useRemoteIntegrations } from "@/lib/repositories/remote";
import { usePanelAccess } from "../panel-shell";
import { hasFeature } from "@/lib/plans";
import type { GatewayId, IntegrationSettings, Order, WhatsappTrigger } from "@/lib/types";
import { normalizePixKey } from "@/lib/pix";
import { markStep } from "@/lib/training/progress";
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
        <p className="text-sm text-cz-muted">Como você recebe (Pix, dinheiro e cartão), avisos automáticos no WhatsApp e e-mail para o cliente.</p>
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
            <Mail className="size-4" aria-hidden /> E-mail
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
    if (kind === "evo-text") return evolution.sendText(evolutionInstanceName(tenant.slug), number, `Olá! Pedido recebido na ${tenant.name}.`);
    return evolution.sendMedia(evolutionInstanceName(tenant.slug), number, { url: products[0]?.image ?? "", caption: products[0]?.name });
  }, [kind, sample, tenant, settings, origin, categories, products, to]);

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
            ? { op: "sendText", slug: tenant.slug, to, text: body.text ?? body.textMessage?.text }
            : { op: "sendMedia", slug: tenant.slug, to, url: body.media ?? body.mediaMessage?.media, caption: body.caption ?? body.mediaMessage?.caption },
        ),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      toast.success("Mensagem enviada");
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
          <h2 className="font-bold">Como conectar o WhatsApp</h2>
          <Switch checked={w.enabled} onCheckedChange={(v) => set((s) => ({ ...s, whatsapp: { ...s.whatsapp, enabled: v } }))} label="WhatsApp ativo" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Como conectar o WhatsApp">
          {(
            [
              ["whaileys", "WhatsApp da loja (recomendado)", "Mensagens com botões e listas · um número por loja"],
              ["evolution", "Conexão alternativa", "Outro servidor de WhatsApp, também por QR Code"],
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
          // Servidor e chave fixos no ComandaZero; cada loja tem a própria conexão (cz-<loja>).
          <EvolutionConnect tenant={tenant} />
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
        <h2 className="font-bold">Teste uma mensagem</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mensagem" id="pl-kind">
            <Select id="pl-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="order">Pedido recebido (botões)</option>
              <option value="buttons">Mensagem com 3 botões</option>
              <option value="list">Lista de categorias</option>
              <option value="menu">Menu automático</option>
              <option value="evo-text">Texto (servidor próprio)</option>
              <option value="evo-media">Foto (servidor próprio)</option>
            </Select>
          </Field>
          <Field label="Enviar para" id="pl-to">
            <Input id="pl-to" inputMode="tel" value={to} onChange={(e) => setTo(formatPhone(e.target.value))} />
          </Field>
        </div>
        {isWhaileys && <ChatPreview card={payload as ReturnType<typeof numberedCard>["card"]} />}
        <details className="rounded-xl border border-cz-border p-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Detalhes técnicos (para o suporte)</summary>
          <p className="mb-1 mt-2 text-xs font-semibold text-cz-muted">{isWhaileys ? "POST /sessions/cpw-" + tenant.slug + "/send" : `${(payload as { method: string }).method} ${(payload as { path: string }).path}`}</p>
          <pre className="min-w-0 max-w-full whitespace-pre-wrap break-all max-h-72 overflow-auto rounded-xl bg-[#08162d] p-3 text-xs text-[#e3c58c]">{JSON.stringify(isWhaileys ? { to: toWhatsappNumber(to), ...payload } : (payload as { body: unknown }).body, null, 2)}</pre>
        </details>
        <Button variant="brand" onClick={send} loading={sending}>
          <Send className="size-4" aria-hidden /> {isWhaileys ? "Enviar de verdade pelo WhatsApp da loja" : "Enviar pelo servidor próprio"}
        </Button>
        {!isWhaileys && <p className="text-xs text-cz-muted">Conecte o número acima (Gerar QR Code) antes de enviar.</p>}
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
    <div className="grid gap-4">
    <SimplePayments settings={settings} set={set} slug={tenant.slug} />
    <details className="group rounded-[14px] border border-cz-border bg-cz-surface p-4" data-testid="pagamento-avancado">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 font-bold">
        Confirmação automática do pagamento (opcional)
        <span className="text-sm font-normal text-cz-muted group-open:hidden">Mostrar</span>
      </summary>
      <p className="mt-1 text-sm text-cz-muted">Ligue com o seu banco ou maquininha para o pedido ficar “Pago” sozinho, sem você conferir. Não é necessário para começar a vender.</p>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
      <Card className="grid min-w-0 content-start gap-3">
        <h2 className="font-bold">Bancos e maquininhas</h2>
        <p className="text-sm text-cz-muted">Escolha com qual empresa o pagamento é confirmado automaticamente.</p>
        <ul className="grid gap-2">
          {ids.map((id) => {
            const c = settings.payments.gateways[id];
            return (
              <li key={id}>
                <div className={cn("flex items-center gap-3 rounded-2xl border p-3", gw === id ? "border-cz-text bg-cz-surface-2" : "border-cz-border")}>
                  <button type="button" onClick={() => setGw(id)} className="min-h-11 flex-1 text-left" aria-pressed={gw === id}>
                    <p className="text-sm font-bold">{GATEWAYS[id].label}</p>
                    <p className="text-xs text-cz-muted">{GATEWAY_HINT[id]}</p>
                  </button>
                  <Badge tone={c.enabled ? "green" : "neutral"}>{c.enabled ? (c.mode === "producao" ? "Ligado" : "Em teste") : "Desligado"}</Badge>
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
          <Field label="Cartão online pelo" id="cardgw">
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
                <option value="sandbox">Em teste (sem cobrar)</option>
                <option value="producao">Valendo (cobrança real)</option>
              </Select>
            </Field>
            <Field label="Código de acesso (cadastrado pelo suporte)" id="gw-key" hint="A senha da empresa fica guardada no servidor, nunca no navegador.">
              <Input id="gw-key" value={cfg.keyRef} onChange={(e) => setCfg({ keyRef: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} />
            </Field>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm font-semibold">
              <Switch checked={cfg.split} onCheckedChange={(v) => setCfg({ split: v })} label="Dividir o valor com a plataforma" /> Dividir valor
            </label>
          </div>
        )}
        <p className="text-sm text-cz-muted">Simulação de um pagamento de {money(amount)}: o pedido abaixo seria marcado como pago sozinho.</p>
        <details className="rounded-xl border border-cz-border p-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Detalhes técnicos (para o suporte)</summary>
        <p className="mt-2 text-xs font-semibold text-cz-muted">
          1. Cobrança · {req.method} {req.url}
        </p>
        <pre className="min-w-0 max-w-full whitespace-pre-wrap break-all max-h-64 overflow-auto rounded-xl bg-[#08162d] p-3 text-xs text-[#e3c58c]">{JSON.stringify({ headers: req.headers, body: req.body }, null, 2)}</pre>
        <p className="text-xs font-semibold text-cz-muted">2. Aviso de pagamento confirmado recebido em {input.webhookUrl}</p>
        <pre className="min-w-0 max-w-full whitespace-pre-wrap break-all max-h-48 overflow-auto rounded-xl bg-[#08162d] p-3 text-xs text-[#9cc3f0]">{JSON.stringify(hook, null, 2)}</pre>
        </details>
        <p className="rounded-xl bg-cz-success/10 p-3 text-sm text-cz-success">
          Resultado: pedido <b>{parsed?.chargeId}</b> → <b>{parsed?.status === "paid" ? "PAGO" : parsed?.status}</b> · {money(amount)}
        </p>
      </Card>
    </div>
    </details>
    </div>
  );
}

// O que cada empresa faz, em linguagem de lojista (QA-16). Detalhe técnico fica em GATEWAYS[id].features.
const GATEWAY_HINT: Record<GatewayId, string> = {
  infinitepay: "Pix e maquininha InfinitePay",
  asaas: "Pix com QR Code e link de pagamento",
  mercadopago: "Pix, maquininha Point e link de pagamento",
  pagbank: "Pix, cartão e maquininha PagBank",
  stone: "Pix, link e maquininha Ton/Stone",
  presencial: "Dinheiro com troco, cartão na maquininha e vale-refeição",
};

/** Recebimento simples (sem API): Pix na chave da loja, dinheiro com troco e cartão na maquininha. */
function SimplePayments({ settings, set, slug }: TabProps & { slug: string }) {
  const [key, setKey] = useState(settings.payments.pixKey ?? "");
  const [holder, setHolder] = useState(settings.payments.pixName ?? "");
  const presencial = settings.payments.gateways.presencial;
  const save = () => {
    const k = key.trim() ? normalizePixKey(key) : "";
    if (k === null) return toast.error("Chave Pix inválida. Use CPF, CNPJ, e-mail, celular ou chave aleatória.");
    if (k && holder.trim().length < 2) return toast.error("Informe o nome de quem recebe o Pix.");
    set((s) => ({ ...s, payments: { ...s.payments, pixKey: k || undefined, pixName: k ? holder.trim() : undefined } }));
    markStep(slug, "pix");
    toast.success(k ? "Pix salvo. O cliente já paga na sua chave." : "Recebimento salvo.");
  };
  return (
    <Card className="grid gap-4" data-tour="receber-simples">
      <div>
        <h2 className="font-bold">Como você recebe</h2>
        <p className="text-sm text-cz-muted">Sem configuração técnica. O dinheiro cai direto na sua conta.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Chave Pix" id="pix-key" hint="Ex.: CPF, CNPJ, e-mail ou celular (19) 99999-0000">
          <Input id="pix-key" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória" />
        </Field>
        <Field label="Nome de quem recebe" id="pix-name" hint="Como aparece no banco. O cliente confere antes de pagar.">
          <Input id="pix-name" autoComplete="organization" value={holder} onChange={(e) => setHolder(e.target.value)} />
        </Field>
        <Button variant="brand" onClick={save}>
          Salvar
        </Button>
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-[10px] bg-cz-surface-2 px-3 text-sm font-semibold">
        Dinheiro (com troco) e cartão na maquininha
        <Switch
          checked={presencial.enabled}
          onCheckedChange={(v) => (set((s) => ({ ...s, payments: { ...s.payments, gateways: { ...s.payments.gateways, presencial: { ...presencial, enabled: v } } } })), markStep(slug, "pix"))}
          label="Aceitar dinheiro e cartão na maquininha"
        />
      </label>
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-[10px] bg-cz-surface-2 px-3 text-sm font-semibold">
        <span>
          Vale-refeição
          <span className="block text-xs font-normal text-cz-muted">{settings.payments.acceptVR.join(", ")}</span>
        </span>
        <Switch
          checked={!!settings.payments.vrEnabled && presencial.enabled}
          onCheckedChange={(v) => set((s) => ({ ...s, payments: { ...s.payments, vrEnabled: v } }))}
          label="Aceitar vale-refeição"
        />
      </label>
    </Card>
  );
}

function EmailTab({ settings, set }: TabProps) {
  const { tenant, sample } = useTenantCtx();
  const orders = useOrders(tenant.id);
  const e = settings.email;
  // Remetente fixo por loja no domínio verificado do sistema (sem DNS por loja).
  const from = fromAddress(e.fromName || tenant.name, tenant.subdomain);
  const [tpl, setTpl] = useState<"pedido" | "bolo" | "caixa" | "boas-vindas">("pedido");
  const [sending, setSending] = useState(false);
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

  const request = buildSendRequest({ from, to: [e.ownerEmail || "cliente@exemplo.com.br"], subject: email.subject, html: "<…html do template…>" });

  const sendTest = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.ownerEmail)) return toast.error("Informe o e-mail do dono para receber o teste.");
    setSending(true);
    try {
      const r = await fetch("/api/email/teste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: tenant.slug }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; to?: string };
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      toast.success(`E-mail de teste enviado para ${d.to}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
      <Card className="grid min-w-0 content-start gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">E-mail para o cliente</h2>
          <Switch checked={e.enabled} onCheckedChange={(v) => set((s) => ({ ...s, email: { ...s.email, enabled: v } }))} label="E-mail ativo" />
        </div>
        <p className="text-xs text-cz-muted">
          Envia recibo do pedido e o fechamento do caixa por e-mail, com o nome da sua loja.
        </p>
        <Field label="Nome do remetente" id="em-name">
          <Input id="em-name" value={e.fromName} placeholder={tenant.name} onChange={(ev) => set((s) => ({ ...s, email: { ...s.email, fromName: ev.target.value } }))} />
        </Field>
        <div className="grid gap-1 rounded-xl bg-cz-surface-2 p-3 text-sm">
          <span className="text-xs font-semibold text-cz-muted">O cliente recebe de</span>
          <span className="break-all font-semibold" data-testid="email-remetente">
            {from}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-cz-muted">
            <Badge tone="green">Pronto para enviar</Badge> Endereço exclusivo da sua loja, sem configurar nada.
          </span>
        </div>
        <Field label="E-mail do dono" id="em-owner" hint="Recebe o fechamento do caixa e as respostas dos clientes.">
          <Input id="em-owner" type="email" autoComplete="email" value={e.ownerEmail} onChange={(ev) => set((s) => ({ ...s, email: { ...s.email, ownerEmail: ev.target.value.trim() } }))} />
        </Field>
        <Button variant="secondary" className="justify-self-start" onClick={() => void sendTest()} loading={sending} disabled={tenant.isDemo !== false}>
          <Send className="size-4" aria-hidden /> Enviar e-mail de teste para mim
        </Button>
        {tenant.isDemo !== false && <p className="text-xs text-cz-muted">Na loja de demonstração o envio real fica desligado.</p>}
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
