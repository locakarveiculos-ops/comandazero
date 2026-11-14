"use client";

/* eslint-disable @next/next/no-img-element -- fotos podem vir de upload do lojista */
import { Banknote, CreditCard, Loader2, MapPin, QrCode, Ticket, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Modal, Stepper } from "@/components/ui";
import { themeVars } from "@/components/tenant-theme";
import { PixModal } from "./pix-modal";
import { createSandboxCharge, gatewayFor } from "@/lib/integrations/payments/factory";
import type { ChargeResult } from "@/lib/integrations/payments/types";
import { couponDiscount, couponError } from "@/lib/pricing";
import { isRemote } from "@/lib/repositories/engine";
import { addToTable, clearCart, createOrder, findCoupon, markOrderPaid, rememberCustomer, setCartQty, useCart, useDb, useIntegrations } from "@/lib/repositories";
import type { OrderMode, PaymentMethod, Tenant } from "@/lib/types";
import { MODE_LABEL, cartSubtotal, cn, formatCep, formatPhone, isValidBrPhone, money, onlyDigits, round2 } from "@/lib/utils";

type Address = { cep: string; street: string; number: string; district: string; city: string; complement: string };

const PAY: { id: PaymentMethod; label: string; icon: typeof QrCode; hint: string }[] = [
  { id: "pix", label: "Pix", icon: QrCode, hint: "Aprovação na hora" },
  { id: "cartao_credito", label: "Cartão", icon: CreditCard, hint: "Na maquininha" },
  { id: "dinheiro", label: "Dinheiro", icon: Banknote, hint: "Informe o troco" },
  { id: "vale_refeicao", label: "Vale-refeição", icon: Ticket, hint: "Alelo, Pluxee, VR, Ticket" },
];

export function Checkout({ tenant, mode, table, open, onOpenChange }: { tenant: Tenant; mode: OrderMode; table?: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const items = useCart(tenant.id);
  const saved = useDb((s) => s.customer);
  const settings = useIntegrations(tenant.id);

  const [name, setName] = useState(saved?.name ?? "");
  const [phone, setPhone] = useState(saved ? formatPhone(saved.phone) : "");
  const [addr, setAddr] = useState<Address>({ cep: "", street: "", number: "", district: "", city: tenant.address.city, complement: "" });
  const [zoneId, setZoneId] = useState("");
  const [cepState, setCepState] = useState<"idle" | "loading" | "error">("idle");
  const [pickupTime, setPickupTime] = useState("");
  const [pay, setPay] = useState<PaymentMethod>("pix");
  const [changeFor, setChangeFor] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [tried, setTried] = useState(false);
  const [charge, setCharge] = useState<ChargeResult | null>(null);
  const [pendingOrder, setPendingOrder] = useState<{ id: string; amount: number } | null>(null);

  const isPreorder = items.some((i) => i.cake);
  const zone = tenant.deliveryZones.find((z) => z.id === zoneId);
  const subtotal = cartSubtotal(items);
  const deliveryFee = mode === "delivery" ? (zone?.fee ?? 0) : 0;
  const coupon = appliedCoupon ? findCoupon(tenant.id, appliedCoupon) : undefined;
  const discount = couponDiscount(coupon, subtotal, deliveryFee);
  const total = round2(Math.max(0, subtotal + deliveryFee - discount));
  const depositPct = isPreorder ? 50 : 0;
  const deposit = depositPct ? round2((total * depositPct) / 100) : 0;
  const payNow = deposit || total;

  const errors: Record<string, string> = {};
  {
    const e = errors;
    if (name.trim().length < 2) e.name = "Informe seu nome";
    if (!isValidBrPhone(phone)) e.phone = "WhatsApp com DDD, ex.: (19) 99999-0000";
    if (mode === "delivery") {
      if (onlyDigits(addr.cep).length !== 8) e.cep = "CEP com 8 dígitos";
      if (!addr.street.trim()) e.street = "Informe a rua";
      if (!addr.number.trim()) e.number = "Número";
      if (!zone) e.zone = "Escolha o bairro de entrega";
    }
    if (subtotal < tenant.minOrder && mode === "delivery") e.min = `Pedido mínimo para entrega: ${money(tenant.minOrder)}`;
    if (pay === "dinheiro" && changeFor && Number(changeFor.replace(",", ".")) < total) e.change = "Valor menor que o total";
    if (isPreorder && pay !== "pix") e.pay = "Encomendas exigem sinal via Pix";
  }

  const lookupCep = async (raw: string) => {
    const cep = onlyDigits(raw);
    if (cep.length !== 8) return;
    setCepState("loading");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string };
      if (d.erro) throw new Error();
      setAddr((a) => ({ ...a, street: d.logradouro || a.street, district: d.bairro || a.district, city: d.localidade || a.city }));
      const match = tenant.deliveryZones.find((z) => d.bairro && normalize(d.bairro).includes(normalize(z.bairro)));
      if (match) setZoneId(match.id);
      setCepState("idle");
    } catch {
      setCepState("error");
    }
  };

  const applyCoupon = () => {
    const c = findCoupon(tenant.id, couponCode);
    const err = couponError(c, subtotal);
    if (err) return toast.error(err);
    setAppliedCoupon(c!.code);
    toast.success(`Cupom ${c!.code} aplicado`);
  };

  const finish = (orderId: string, token?: string) => {
    clearCart(tenant.id);
    onOpenChange(false);
    router.push(`/loja/${tenant.slug}/pedido/${orderId}${token ? `?t=${token}` : ""}`);
  };

  const [sending, setSending] = useState(false);
  const [idemKey] = useState(() => crypto.randomUUID().replace(/-/g, ""));

  /** Loja real: o servidor recalcula tudo pelo banco; aqui só vão ids, quantidades e escolhas. */
  const submitRemote = async () => {
    setSending(true);
    try {
      const r = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: tenant.slug,
          mode: isPreorder ? "encomenda" : mode,
          items: items.map((i) => ({
            product_id: i.productId,
            qty: i.qty,
            choice_ids: i.options.map((o) => o.choiceId),
            notes: i.notes,
            ...(i.cake?.kg ? { cake: i.cake } : {}),
          })),
          customer: { name: name.trim(), phone },
          payment: pay,
          zoneId: mode === "delivery" ? zoneId : undefined,
          address: mode === "delivery" ? { ...addr, district: zone?.bairro ?? addr.district } : undefined,
          table: mode === "mesa" ? table : undefined,
          coupon: appliedCoupon || undefined,
          changeFor: pay === "dinheiro" && changeFor ? Number(changeFor.replace(",", ".")) : undefined,
          scheduledFor: !isPreorder && pickupTime ? todayAt(pickupTime) : undefined,
          idempotencyKey: idemKey,
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { id?: string; number?: number; trackToken?: string; error?: string };
      if (!r.ok || !d.id) throw new Error(d.error || "Não foi possível enviar o pedido.");
      // Guarda o acesso ao pedido neste aparelho (o link com o token também funciona em qualquer outro).
      try {
        const k = `cz-meus-pedidos:${tenant.slug}`;
        const list = JSON.parse(localStorage.getItem(k) || "[]") as { id: string; t: string; n: number }[];
        localStorage.setItem(k, JSON.stringify([{ id: d.id, t: d.trackToken, n: d.number }, ...list].slice(0, 10)));
      } catch {
        /* sem storage: link do pedido continua válido */
      }
      toast.success(`Pedido #${d.number} enviado!`);
      finish(d.id, d.trackToken);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const submit = () => {
    setTried(true);
    if (Object.keys(errors).length) {
      toast.error(Object.values(errors)[0]);
      return;
    }
    rememberCustomer(name.trim(), phone);
    if (isRemote(tenant)) return void submitRemote();
    const gateway = gatewayFor(settings, pay);
    const order = createOrder({
      tenantId: tenant.id,
      channel: mode === "mesa" ? "mesa" : "loja",
      mode: isPreorder ? "encomenda" : mode,
      items,
      deliveryFee,
      discount,
      payments: [{ method: pay, amount: payNow, gateway }],
      gateway,
      customer: { name, phone },
      address: mode === "delivery" ? { ...addr, district: zone?.bairro ?? addr.district } : undefined,
      table: mode === "mesa" ? table : undefined,
      scheduledFor: isPreorder ? items.find((i) => i.cake)?.cake?.pickupAt : pickupTime ? todayAt(pickupTime) : undefined,
      deposit: deposit || undefined,
      changeFor: pay === "dinheiro" && changeFor ? Number(changeFor.replace(",", ".")) : undefined,
      coupon: appliedCoupon || undefined,
    });
    if (mode === "mesa" && table) addToTable(tenant.id, table, items.map((i) => ({ ...i, orderId: order.id })));
    if (pay === "pix") {
      setPendingOrder({ id: order.id, amount: payNow });
      setCharge(
        createSandboxCharge(
          gateway,
          {
            orderId: order.id,
            amount: payNow,
            description: `Pedido #${order.number} ${tenant.name}`,
            method: "pix",
            customer: { name, phone: order.customer.phone },
            webhookUrl: `${window.location.origin}/api/webhooks/pagamentos/${gateway}`,
          },
          { pixKey: `${tenant.slug}@pix.demo.comandazero`, merchant: tenant.name, city: tenant.address.city },
        ),
      );
      return;
    }
    toast.success(`Pedido #${order.number} enviado!`);
    finish(order.id);
  };

  const err = (k: string) => (tried ? errors[k] : undefined);
  const inputCls = "min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink placeholder:text-muted aria-[invalid=true]:border-red-600";

  return (
    <>
      <Modal open={open && !charge} onOpenChange={onOpenChange} title="Seu pedido" description={`${tenant.name} · ${isPreorder ? "Encomenda" : MODE_LABEL[mode]}${table ? ` · Mesa ${table}` : ""}`} side="right" themeStyle={themeVars(tenant.theme)}>
        {items.length === 0 ? (
          <p className="p-6 text-center text-muted">Seu carrinho está vazio. Que tal um café? ☕</p>
        ) : (
          <div className="grid gap-6 p-5">
            <ul className="grid gap-3" aria-label="Itens do carrinho">
              {items.map((i) => (
                <li key={i.key} className="flex gap-3 rounded-2xl border border-line p-3">
                  <img src={i.image} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight text-ink">{i.name}</p>
                    {i.options.length > 0 && <p className="text-xs text-muted">{i.options.map((o) => o.name).join(", ")}</p>}
                    {i.cake?.kg ? <p className="text-xs text-muted">{`${i.cake.kg} kg · ${i.cake.massa} · ${i.cake.recheio}`}</p> : null}
                    {i.notes && <p className="text-xs italic text-muted">“{i.notes}”</p>}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {i.cake ? (
                        <button type="button" onClick={() => setCartQty(tenant.id, i.key, 0)} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-red-700">
                          <Trash2 className="size-4" aria-hidden /> Remover
                        </button>
                      ) : (
                        <Stepper value={i.qty} onChange={(q) => setCartQty(tenant.id, i.key, q)} label={`quantidade de ${i.name}`} />
                      )}
                      <span className="font-bold tabular-nums text-ink">{money(i.unitPrice * i.qty)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <section className="grid gap-3" aria-labelledby="h-voce">
              <h3 id="h-voce" className="font-bold text-ink">
                Seus dados
              </h3>
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Nome
                <input className={inputCls} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!err("name")} />
                {err("name") && <span className="text-xs text-red-700">{err("name")}</span>}
              </label>
              <label className="grid gap-1 text-sm font-semibold text-ink">
                WhatsApp
                <input className={inputCls} inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(19) 99999-0000" aria-invalid={!!err("phone")} />
                <span className={cn("text-xs font-normal", err("phone") ? "text-red-700" : "text-muted")}>{err("phone") ?? "Avisamos cada etapa do pedido por aqui."}</span>
              </label>
            </section>

            {mode === "delivery" && (
              <section className="grid gap-3" aria-labelledby="h-end">
                <h3 id="h-end" className="flex items-center gap-2 font-bold text-ink">
                  <MapPin className="size-4" aria-hidden /> Endereço de entrega
                </h3>
                <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                  <label className="grid gap-1 text-sm font-semibold text-ink">
                    CEP
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={addr.cep}
                      aria-invalid={!!err("cep") || cepState === "error"}
                      onChange={(e) => {
                        const cep = formatCep(e.target.value);
                        setAddr({ ...addr, cep });
                        if (onlyDigits(cep).length === 8) void lookupCep(cep);
                      }}
                    />
                  </label>
                  {cepState === "loading" && <Loader2 className="mb-3 size-5 animate-spin text-muted" aria-label="Buscando CEP" />}
                </div>
                {cepState === "error" && <p className="text-xs text-red-700">CEP não encontrado. Preencha o endereço manualmente.</p>}
                <div className="grid grid-cols-[1fr_96px] gap-2">
                  <label className="grid gap-1 text-sm font-semibold text-ink">
                    Rua
                    <input className={inputCls} autoComplete="address-line1" value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} aria-invalid={!!err("street")} />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-ink">
                    Número
                    <input className={inputCls} value={addr.number} onChange={(e) => setAddr({ ...addr, number: e.target.value })} aria-invalid={!!err("number")} />
                  </label>
                </div>
                <label className="grid gap-1 text-sm font-semibold text-ink">
                  Complemento
                  <input className={inputCls} autoComplete="address-line2" value={addr.complement} onChange={(e) => setAddr({ ...addr, complement: e.target.value })} placeholder="Apto, bloco, referência" />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-ink">
                  Bairro de entrega
                  <select className={inputCls} value={zoneId} onChange={(e) => setZoneId(e.target.value)} aria-invalid={!!err("zone")}>
                    <option value="">Selecione</option>
                    {tenant.deliveryZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.bairro} · {money(z.fee)} · ~{z.minutes} min
                      </option>
                    ))}
                  </select>
                  <span className="text-xs font-normal text-muted">Fora da lista? {money(tenant.deliveryPerKm)}/km, combinado pelo WhatsApp.</span>
                </label>
              </section>
            )}

            {mode === "retirada" && !isPreorder && (
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Horário de retirada (opcional)
                <input type="time" className={inputCls} value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
                <span className="text-xs font-normal text-muted">Sem horário: fica pronto em ~{tenant.prepMinutes} min.</span>
              </label>
            )}

            <section className="grid gap-3" aria-labelledby="h-pag">
              <h3 id="h-pag" className="font-bold text-ink">
                Pagamento
              </h3>
              {isRemote(tenant) && pay === "pix" && (
                <p className="rounded-xl bg-highlight/15 p-3 text-xs text-ink" data-testid="pix-presencial">
                  O Pix é pago na retirada ou entrega, direto para a loja. O pagamento online entra quando a loja ativar o gateway.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de pagamento">
                {PAY.map((p) => {
                  const on = pay === p.id;
                  const disabled = isPreorder && p.id !== "pix";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={disabled}
                      onClick={() => setPay(p.id)}
                      className={cn("flex min-h-16 flex-col items-start justify-center rounded-2xl border p-3 text-left disabled:opacity-40", on ? "border-ink bg-ink/5" : "border-line")}
                    >
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <p.icon className="size-4" aria-hidden /> {p.label}
                      </span>
                      <span className="text-xs text-muted">{p.hint}</span>
                    </button>
                  );
                })}
              </div>
              {pay === "dinheiro" && (
                <label className="grid gap-1 text-sm font-semibold text-ink">
                  Troco para quanto?
                  <input className={inputCls} inputMode="decimal" value={changeFor} onChange={(e) => setChangeFor(e.target.value.replace(/[^\d,]/g, ""))} placeholder="Ex.: 100" aria-invalid={!!err("change")} />
                  <span className={cn("text-xs font-normal", err("change") ? "text-red-700" : "text-muted")}>
                    {err("change") ?? (changeFor && Number(changeFor.replace(",", ".")) >= total ? `Troco: ${money(Number(changeFor.replace(",", ".")) - total)}` : "Deixe vazio se não precisar.")}
                  </span>
                </label>
              )}
              {pay === "vale_refeicao" && <p className="text-xs text-muted">Aceitamos: {settings?.payments.acceptVR.join(", ")}.</p>}
            </section>

            <div className="flex gap-2">
              <input aria-label="Cupom de desconto" className={inputCls} value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Cupom (ex.: PAUSA10)" />
              <Button variant="outline" className="text-ink" onClick={applyCoupon} disabled={!couponCode}>
                Aplicar
              </Button>
            </div>

            <dl className="grid gap-1.5 rounded-2xl bg-paper p-4 text-sm text-ink">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{money(subtotal)}</dd>
              </div>
              {mode === "delivery" && (
                <div className="flex justify-between">
                  <dt>Entrega</dt>
                  <dd className="tabular-nums">{zone ? money(deliveryFee) : "—"}</dd>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-secondary">
                  <dt>Desconto ({appliedCoupon})</dt>
                  <dd className="tabular-nums">− {money(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(total)}</dd>
              </div>
              {deposit > 0 && (
                <div className="flex justify-between font-semibold text-accent-text">
                  <dt>Sinal agora (50%)</dt>
                  <dd className="tabular-nums">{money(deposit)}</dd>
                </div>
              )}
            </dl>
            {tried && errors.min && <p role="alert" className="text-sm font-semibold text-red-700">{errors.min}</p>}
          </div>
        )}
        {items.length > 0 && (
          <div className="sticky bottom-0 border-t border-line bg-surface p-4">
            <Button size="lg" className="w-full justify-between" onClick={submit} loading={sending}>
              <span>{pay === "pix" && !isRemote(tenant) ? "Pagar com Pix" : "Enviar pedido"}</span>
              <span className="tabular-nums">{money(payNow)}</span>
            </Button>
          </div>
        )}
      </Modal>
      <PixModal
        open={!!charge}
        charge={charge}
        amount={pendingOrder?.amount ?? 0}
        tenant={tenant}
        onClose={() => {
          // Pedido fica registrado como "aguardando pagamento"; a página de acompanhamento permite pagar depois.
          if (pendingOrder) finish(pendingOrder.id);
          setCharge(null);
        }}
        onPaid={() => {
          if (pendingOrder) {
            markOrderPaid(pendingOrder.id);
            toast.success("Pagamento confirmado! Seu pedido foi para a cozinha.");
            finish(pendingOrder.id);
          }
          setCharge(null);
        }}
      />
    </>
  );
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function todayAt(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}
