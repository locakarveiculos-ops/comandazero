"use client";

/* eslint-disable @next/next/no-img-element -- fotos podem vir de upload (data URL) do lojista */
import { CalendarClock, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Modal, Stepper, Textarea } from "@/components/ui";
import { earliestPickup, selectedOptions, unitPrice, validateSelections, type Selections } from "@/lib/pricing";
import type { CakeOrder, CartItem, Product, Tenant } from "@/lib/types";
import { cn, fmtDateTime, money, round2 } from "@/lib/utils";
import { displayFont, themeVars } from "@/components/tenant-theme";

const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function ProductModal({
  product,
  tenant,
  onClose,
  onAdd,
  confirmLabel = "Adicionar",
}: {
  product: Product | null;
  tenant: Tenant;
  onClose: () => void;
  onAdd: (item: Omit<CartItem, "key">) => void;
  confirmLabel?: string;
}) {
  return (
    <Modal open={!!product} onOpenChange={(v) => !v && onClose()} title={product?.name ?? "Produto"} side="bottom" hideTitle themeStyle={themeVars(tenant.theme)}>
      {product && <ProductForm key={product.id} product={product} tenant={tenant} onAdd={onAdd} confirmLabel={confirmLabel} />}
    </Modal>
  );
}

function ProductForm({ product, tenant, onAdd, confirmLabel }: { product: Product; tenant: Tenant; onAdd: (item: Omit<CartItem, "key">) => void; confirmLabel: string }) {
  const [sel, setSel] = useState<Selections>(() =>
    Object.fromEntries(product.optionGroups.filter((g) => g.min === 1 && g.max === 1).map((g) => [g.id, [g.choices[0].id]])),
  );
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const lead = product.cake?.leadHours ?? product.preorder?.leadHours ?? 0;
  const minPickup = useMemo(() => (lead ? earliestPickup(lead) : null), [lead]);
  const [cake, setCake] = useState<CakeOrder | null>(() =>
    product.cake
      ? {
          kg: product.cake.minKg,
          massa: product.cake.massas[0],
          recheio: product.cake.recheios[0],
          cobertura: product.cake.coberturas[0],
          frase: "",
          pickupAt: toLocalInput(earliestPickup(product.cake.leadHours)),
        }
      : null,
  );
  const [pickup, setPickup] = useState(() => (product.preorder ? toLocalInput(earliestPickup(product.preorder.leadHours)) : ""));

  const errors = validateSelections(product, sel);
  const pickupValue = cake?.pickupAt ?? pickup;
  const pickupError = minPickup && pickupValue && new Date(pickupValue) < new Date(minPickup.getTime() - 60000) ? `Retirada a partir de ${fmtDateTime(minPickup.toISOString())}` : "";
  const unit = unitPrice(product, sel, cake ?? undefined);
  const total = round2(unit * qty);
  const deposit = product.cake?.depositPct ?? product.preorder?.depositPct;

  const toggle = (groupId: string, choiceId: string, max: number) =>
    setSel((s) => {
      const cur = s[groupId] ?? [];
      if (max === 1) return { ...s, [groupId]: cur[0] === choiceId ? [] : [choiceId] };
      if (cur.includes(choiceId)) return { ...s, [groupId]: cur.filter((x) => x !== choiceId) };
      if (cur.length >= max) return s;
      return { ...s, [groupId]: [...cur, choiceId] };
    });

  const submit = () => {
    setTried(true);
    if (errors.length || pickupError) return;
    const allNotes = [...tags, notes.trim()].filter(Boolean).join(" · ");
    onAdd({
      productId: product.id,
      name: product.name,
      image: product.image,
      unitPrice: unit,
      qty,
      options: selectedOptions(product, sel),
      notes: allNotes,
      cake: cake ? { ...cake, pickupAt: new Date(cake.pickupAt).toISOString() } : product.preorder ? { kg: 0, massa: "", recheio: "", cobertura: "", frase: "", pickupAt: new Date(pickup).toISOString() } : undefined,
    });
  };

  return (
    <div className="flex flex-col">
      <div className="relative aspect-[16/9] max-h-[40vh] w-full shrink-0 bg-stone-200 sm:aspect-[2/1]">
        <img src={product.image} alt="" className="size-full object-cover" />
      </div>
      <div className="grid gap-5 p-5">
        <div>
          {product.badge && <p className="text-xs font-bold uppercase tracking-wider text-accent-text">{product.badge}</p>}
          <h2 className={cn("mt-1 text-2xl font-bold text-ink", displayFont(tenant))}>{product.name}</h2>
          <p className="mt-1.5 text-sm text-muted">{product.description}</p>
          <p className="mt-2 font-bold tabular-nums text-ink">{product.priceLabel ?? money(product.price)}</p>
        </div>

        {product.cake && cake && (
          <fieldset className="grid gap-4 rounded-2xl border border-line bg-paper p-4">
            <legend className="flex items-center gap-2 px-1 text-sm font-bold text-ink">
              <CalendarClock className="size-4" aria-hidden /> Encomenda programada
            </legend>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">Peso</p>
                <p className="text-xs text-muted">
                  {product.cake.minKg} a {product.cake.maxKg} kg · {money(product.cake.pricePerKg)}/kg
                </p>
              </div>
              <div className="inline-flex items-center rounded-full border border-line bg-surface" role="group" aria-label="Peso do bolo">
                <button type="button" aria-label="Diminuir peso" className="grid size-11 place-items-center text-lg font-bold text-ink disabled:opacity-40" disabled={cake.kg <= product.cake.minKg} onClick={() => setCake({ ...cake, kg: Math.max(product.cake!.minKg, round2(cake.kg - 0.5)) })}>
                  −
                </button>
                <span className="min-w-16 text-center font-semibold tabular-nums text-ink" aria-live="polite">
                  {cake.kg.toLocaleString("pt-BR")} kg
                </span>
                <button type="button" aria-label="Aumentar peso" className="grid size-11 place-items-center text-lg font-bold text-ink disabled:opacity-40" disabled={cake.kg >= product.cake.maxKg} onClick={() => setCake({ ...cake, kg: Math.min(product.cake!.maxKg, round2(cake.kg + 0.5)) })}>
                  +
                </button>
              </div>
            </div>
            {(
              [
                ["massa", "Massa", product.cake.massas],
                ["recheio", "Recheio", product.cake.recheios],
                ["cobertura", "Cobertura", product.cake.coberturas],
              ] as const
            ).map(([k, label, list]) => (
              <label key={k} className="grid gap-1.5 text-sm font-semibold text-ink">
                {label}
                <select value={cake[k]} onChange={(e) => setCake({ ...cake, [k]: e.target.value })} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-base font-normal text-ink">
                  {list.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            ))}
            <label className="grid gap-1.5 text-sm font-semibold text-ink">
              Frase no topo (opcional)
              <input value={cake.frase} maxLength={40} onChange={(e) => setCake({ ...cake, frase: e.target.value })} placeholder="Ex.: Feliz aniversário, Ana!" className="min-h-11 rounded-xl border border-line bg-surface px-3 text-base font-normal text-ink placeholder:text-muted" />
            </label>
            <PickupInput value={cake.pickupAt} min={minPickup} error={tried ? pickupError : ""} onChange={(v) => setCake({ ...cake, pickupAt: v })} lead={product.cake.leadHours} />
          </fieldset>
        )}

        {product.preorder && <PickupInput value={pickup} min={minPickup} error={tried ? pickupError : ""} onChange={setPickup} lead={product.preorder.leadHours} />}

        {product.optionGroups.map((g) => {
          const chosen = sel[g.id] ?? [];
          const missing = tried && chosen.length < g.min;
          return (
            <fieldset key={g.id} className="grid gap-2" aria-describedby={`${g.id}-rule`}>
              <legend className="flex w-full items-center justify-between gap-2">
                <span className="font-bold text-ink">{g.name}</span>
                <span id={`${g.id}-rule`} className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", g.min ? (missing ? "bg-red-100 text-red-900" : "bg-ink text-paper") : "bg-black/5 text-muted")}>
                  {g.min ? (g.max === 1 ? "Obrigatório" : `Escolha ${g.min} a ${g.max}`) : `Opcional · até ${g.max}`}
                </span>
              </legend>
              {g.max > 1 && (
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={g.max} aria-valuenow={chosen.length} aria-label={`${g.name}: ${chosen.length} de ${g.max} selecionados`}>
                    <div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${(chosen.length / g.max) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-ink" aria-hidden>
                    {chosen.length} de {g.max} selecionados
                  </span>
                </div>
              )}
              <div className="grid gap-2">
                {g.choices.map((c) => {
                  const on = chosen.includes(c.id);
                  const full = !on && g.max > 1 && chosen.length >= g.max;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role={g.max === 1 ? "radio" : "checkbox"}
                      aria-checked={on}
                      disabled={full}
                      onClick={() => toggle(g.id, c.id, g.max)}
                      className={cn(
                        "flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 text-left text-sm transition disabled:opacity-45",
                        on ? "border-ink bg-ink/5 font-semibold text-ink" : "border-line bg-surface text-ink hover:border-ink/40",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span className={cn("grid size-5 place-items-center border-2", g.max === 1 ? "rounded-full" : "rounded-md", on ? "border-ink bg-ink text-paper" : "border-muted")} aria-hidden>
                          {on && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        {c.name}
                      </span>
                      {c.price > 0 && <span className="tabular-nums text-muted">+ {money(c.price)}</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        {(product.quickNotes.length > 0 || !product.cake) && (
          <div className="grid gap-2">
            <p className="font-bold text-ink">Observações</p>
            {product.quickNotes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.quickNotes.map((n) => {
                  const on = tags.includes(n);
                  return (
                    <button key={n} type="button" aria-pressed={on} onClick={() => setTags((t) => (on ? t.filter((x) => x !== n) : [...t, n]))} className={cn("min-h-11 rounded-full border px-4 text-sm", on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink")}>
                      {n}
                    </button>
                  );
                })}
              </div>
            )}
            <Textarea aria-label="Observação livre" value={notes} maxLength={140} onChange={(e) => setNotes(e.target.value)} placeholder="Algum pedido especial?" className="border-line bg-surface text-ink" />
          </div>
        )}

        {tried && errors.length > 0 && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-900">
            {errors.join(" · ")}
          </p>
        )}
        {deposit ? (
          <p className="rounded-xl bg-highlight/15 p-3 text-sm text-ink">
            Encomenda com sinal de <b>{deposit}%</b> ({money(round2((total * deposit) / 100))}) para confirmar. O restante você paga na retirada.
          </p>
        ) : null}
      </div>
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-surface p-4">
        {!product.cake && <Stepper value={qty} onChange={setQty} min={1} max={30} label="quantidade" />}
        <Button size="lg" className="flex-1 justify-between" onClick={submit}>
          <span>{confirmLabel}</span>
          <span className="tabular-nums">{money(total)}</span>
        </Button>
      </div>
    </div>
  );
}

function PickupInput({ value, min, onChange, error, lead }: { value: string; min: Date | null; onChange: (v: string) => void; error: string; lead: number }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-ink">
      Data e hora de retirada
      <input
        type="datetime-local"
        value={value}
        min={min ? toLocalInput(min) : undefined}
        step={1800}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className="min-h-11 rounded-xl border border-line bg-surface px-3 text-base font-normal text-ink aria-[invalid=true]:border-red-600"
      />
      <span className={cn("text-xs font-normal", error ? "font-semibold text-red-700" : "text-muted")} role={error ? "alert" : undefined}>
        {error || `Antecedência mínima de ${lead} horas.`}
      </span>
    </label>
  );
}
