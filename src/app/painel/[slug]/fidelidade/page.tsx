"use client";

import { Coffee, Gift, Plus, TicketPercent } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useStoreTenant } from "@/components/loja/use-store-tenant";
import { Badge, Button, Card, Field, Input, Select, Switch } from "@/components/ui";
import { redeemLoyalty, saveCoupon, updateTenant, useCoupons, useLoyalty, useMenu } from "@/lib/repositories";
import type { Coupon } from "@/lib/types";
import { formatPhone, money, uid } from "@/lib/utils";

export default function FidelidadePage() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant } = useStoreTenant(slug);
  const cards = useLoyalty(tenant?.id);
  const coupons = useCoupons(tenant?.id);
  const { categories } = useMenu(tenant?.id);
  const [code, setCode] = useState("");
  const [type, setType] = useState<Coupon["type"]>("percent");
  const [value, setValue] = useState("10");
  const [min, setMin] = useState("30");

  if (!tenant) return null;
  const l = tenant.loyalty;
  const setL = (patch: Partial<typeof l>) => updateTenant(tenant.id, { loyalty: { ...l, ...patch } });

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="cz-heading text-2xl font-bold">Fidelidade & cupons</h1>
        <p className="text-sm text-cz-muted">Cartão fidelidade digital pelo WhatsApp do cliente, sem app extra nem papel.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <Coffee className="size-4" aria-hidden /> Regra do cartão
            </h2>
            <Switch checked={l.enabled} onCheckedChange={(v) => setL({ enabled: v })} label="Cartão fidelidade ativo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Selos para ganhar" id="goal">
              <Input id="goal" type="number" min={2} max={30} value={l.goal} onChange={(e) => setL({ goal: Math.max(2, Number(e.target.value) || 2) })} />
            </Field>
            <Field label="Cashback (%)" id="cb" hint="0 para desligar">
              <Input id="cb" type="number" min={0} max={20} step={0.5} value={l.cashbackPct} onChange={(e) => setL({ cashbackPct: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
          </div>
          <Field label="Prêmio" id="rw">
            <Input id="rw" value={l.reward} onChange={(e) => setL({ reward: e.target.value })} />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">Categorias que contam selo</legend>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = l.categoryIds.includes(c.id);
                return (
                  <button key={c.id} type="button" aria-pressed={on} onClick={() => setL({ categoryIds: on ? l.categoryIds.filter((x) => x !== c.id) : [...l.categoryIds, c.id] })} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${on ? "border-cz-navy bg-cz-navy text-white" : "border-cz-border"}`}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="rounded-2xl bg-gradient-to-br from-[#2c1a12] to-[#5e3a2a] p-5 text-[#faf6f0]" aria-label="Prévia do cartão">
            <p className="font-serif text-xl font-bold">{tenant.name}</p>
            <p className="text-sm opacity-85">A cada {l.goal}, ganhe {l.reward.toLowerCase()}</p>
            <div className="mt-4 grid grid-cols-5 gap-2" aria-hidden>
              {Array.from({ length: l.goal }, (_, i) => (
                <span key={i} className={`grid aspect-square place-items-center rounded-full border-2 border-[#d49b4b] ${i < 7 ? "bg-[#d49b4b] text-[#2c1a12]" : ""}`}>
                  {i < 7 ? "☕" : ""}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-bold">
            <Gift className="size-4" aria-hidden /> Clientes no programa
          </h2>
          <ul className="mt-3 divide-y divide-cz-border">
            {cards.map((c) => {
              const ready = c.stamps >= l.goal;
              return (
                <li key={c.phone} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-cz-muted">
                      {formatPhone(c.phone)} · {c.redeemed} resgate(s){c.cashback ? ` · cashback ${money(c.cashback)}` : ""}
                    </p>
                  </div>
                  <div className="w-32">
                    <div className="h-2.5 overflow-hidden rounded-full bg-cz-border" role="progressbar" aria-valuemin={0} aria-valuemax={l.goal} aria-valuenow={Math.min(c.stamps, l.goal)} aria-label={`Selos de ${c.name}`}>
                      <div className="h-full rounded-full bg-cz-gold" style={{ width: `${Math.min(100, (c.stamps / l.goal) * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-right text-xs tabular-nums">
                      {c.stamps}/{l.goal}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={ready ? "brand" : "secondary"}
                    disabled={!ready}
                    onClick={() => {
                      redeemLoyalty(tenant.id, c.phone, l.goal);
                      toast.success(`Prêmio resgatado para ${c.name}`);
                    }}
                  >
                    Resgatar
                  </Button>
                </li>
              );
            })}
            {!cards.length && <li className="py-6 text-center text-sm text-cz-muted">Os clientes entram sozinhos ao pedir com WhatsApp.</li>}
          </ul>
        </Card>
      </div>

      <Card className="grid gap-4">
        <h2 className="flex items-center gap-2 font-bold">
          <TicketPercent className="size-4" aria-hidden /> Cupons
        </h2>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_160px_120px_120px_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().toUpperCase();
            if (!/^[A-Z0-9]{3,15}$/.test(c)) return toast.error("Código com 3 a 15 letras/números");
            if (coupons.some((x) => x.code === c)) return toast.error("Cupom já existe");
            saveCoupon({ id: uid("cp"), tenantId: tenant.id, code: c, type, value: Number(value.replace(",", ".")) || 0, minOrder: Number(min.replace(",", ".")) || 0, active: true, uses: 0 });
            toast.success(`Cupom ${c} criado`);
            setCode("");
          }}
        >
          <Field label="Código" id="cc">
            <Input id="cc" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CAFEDOBEM" />
          </Field>
          <Field label="Tipo" id="ct">
            <Select id="ct" value={type} onChange={(e) => setType(e.target.value as Coupon["type"])}>
              <option value="percent">% de desconto</option>
              <option value="fixed">R$ de desconto</option>
              <option value="frete">Frete grátis</option>
            </Select>
          </Field>
          <Field label="Valor" id="cv">
            <Input id="cv" inputMode="decimal" value={value} disabled={type === "frete"} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field label="Pedido mín." id="cm">
            <Input id="cm" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
          </Field>
          <Button type="submit" variant="brand">
            <Plus className="size-4" aria-hidden /> Criar
          </Button>
        </form>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {coupons.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-cz-border p-3">
              <div>
                <p className="font-mono font-bold">{c.code}</p>
                <p className="text-xs text-cz-muted">
                  {c.type === "percent" ? `${c.value}% off` : c.type === "fixed" ? `${money(c.value)} off` : "Frete grátis"} · mín. {money(c.minOrder)} · {c.uses} usos
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={c.active ? "green" : "neutral"}>{c.active ? "Ativo" : "Pausado"}</Badge>
                <Switch checked={c.active} onCheckedChange={(v) => saveCoupon({ ...c, active: v })} label={`Cupom ${c.code} ativo`} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
