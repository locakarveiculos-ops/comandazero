"use client";

/* eslint-disable @next/next/no-img-element -- fotos podem vir de upload */
import { Banknote, CreditCard, Divide, Minus, Plus, QrCode, Search, Ticket, Trash2, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useStoreTenant } from "@/components/loja/use-store-tenant";
import { ProductModal } from "@/components/loja/product-modal";
import { PrintButton } from "@/components/painel/receipt";
import { Button, Modal } from "@/components/ui";
import { changeDue, splitEvenly } from "@/lib/pricing";
import { createOrder, markOrderPaid } from "@/lib/repositories";
import { useStoreMenu } from "@/lib/repositories/engine";
import type { CartItem, Order, PaymentMethod, PaymentSplit, Product } from "@/lib/types";
import { cartSubtotal, cn, money, round2, uid } from "@/lib/utils";

const METHODS: { id: PaymentMethod; label: string; icon: typeof QrCode; key: string }[] = [
  { id: "pix", label: "Pix", icon: QrCode, key: "1" },
  { id: "cartao_debito", label: "Débito", icon: CreditCard, key: "2" },
  { id: "cartao_credito", label: "Crédito", icon: CreditCard, key: "3" },
  { id: "dinheiro", label: "Dinheiro", icon: Banknote, key: "4" },
  { id: "vale_refeicao", label: "Vale", icon: Ticket, key: "5" },
];
const LABEL = Object.fromEntries(METHODS.map((m) => [m.id, m.label]));

export default function PdvPage() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant } = useStoreTenant(slug);
  const { categories, products } = useStoreMenu(tenant);
  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [modal, setModal] = useState<Product | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [last, setLast] = useState<Order | null>(null);
  const search = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => !p.cake && !p.preorder && (cat === "all" || p.categoryId === cat) && (!q || p.code === q || p.name.toLowerCase().includes(q)));
  }, [products, cat, query]);

  const total = cartSubtotal(items);

  const quickAdd = useCallback((p: Product) => {
    if (!p.available) return toast.error(`${p.name} está pausado`);
    if (p.optionGroups.some((g) => g.min > 0)) return setModal(p);
    setItems((cur) => {
      const same = cur.find((i) => i.productId === p.id && !i.options.length && !i.notes);
      if (same) return cur.map((i) => (i === same ? { ...i, qty: i.qty + 1 } : i));
      return [...cur, { key: uid(), productId: p.id, name: p.name, image: p.image, unitPrice: p.price, qty: 1, options: [], notes: "" }];
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        search.current?.focus();
        search.current?.select();
      }
      if (e.key === "F4") {
        e.preventDefault();
        if (items.length) setPayOpen(true);
      }
      if (e.key === "Escape" && document.activeElement === search.current) setQuery("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length]);

  if (!tenant) return null;

  const onSearchEnter = (e: React.KeyboardEvent) => {
    const q = query.trim();
    if (!q) return;
    // O Enter não pode "vazar" para o modal de opções que abre em seguida (fecharia o modal na hora).
    e.preventDefault();
    const exact = products.find((p) => p.code === q) ?? (list.length === 1 ? list[0] : null);
    if (exact) {
      setQuery("");
      requestAnimationFrame(() => quickAdd(exact));
    } else if (!list.length) toast.error(`Código ou produto “${q}” não encontrado`);
    else toast.info(`${list.length} produtos combinam com “${q}”. Toque no desejado ou digite o código.`);
  };

  const finish = (payments: PaymentSplit[], change: number) => {
    const order = createOrder({
      tenantId: tenant.id,
      channel: "balcao",
      mode: "balcao",
      items,
      payments,
      gateway: "presencial",
      paid: true,
      customer: { name: "Balcão", phone: "" },
      changeFor: change > 0 ? round2(total + change) : undefined,
    });
    markOrderPaid(order.id, payments);
    setLast({ ...order, paymentStatus: "pago", payments });
    setItems([]);
    setPayOpen(false);
    toast.success(`Venda #${order.number} finalizada${change > 0 ? ` · troco ${money(change)}` : ""}`);
    search.current?.focus();
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
      <section className="grid min-w-0 content-start gap-3" aria-label="Produtos" data-tour="pdv-produtos">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto cz-heading text-2xl font-bold">PDV Balcão</h1>
          <p className="text-xs text-cz-muted">
            <kbd className="rounded border border-cz-border bg-cz-surface px-1.5 font-mono">F2</kbd> buscar · <kbd className="rounded border border-cz-border bg-cz-surface px-1.5 font-mono">F4</kbd> finalizar · <kbd className="rounded border border-cz-border bg-cz-surface px-1.5 font-mono">Enter</kbd> lança código
          </p>
        </div>
        <label className="relative block">
          <span className="sr-only">Buscar por código ou nome (F2)</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-cz-muted" aria-hidden />
          <input
            ref={search}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearchEnter(e)}
            placeholder="Código ou nome (ex.: 101, cappuccino)"
            data-tour="pdv-busca"
            className="min-h-14 w-full rounded-2xl border border-cz-border bg-cz-surface pl-12 pr-4 text-lg"
          />
        </label>
        <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist" aria-label="Categorias" data-tour="pdv-categorias">
          {[{ id: "all", name: "Todos" }, ...categories].map((c) => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)} className={cn("min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold", cat === c.id ? "bg-brand text-brand-ink" : "bg-cz-surface ring-1 ring-cz-border")}>
              {c.name}
            </button>
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => quickAdd(p)}
                disabled={!p.available}
                className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-cz-border bg-cz-surface text-left transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] disabled:opacity-45"
              >
                <img src={p.image} alt="" className="aspect-[4/3] w-full object-cover" />
                <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 font-mono text-xs font-bold text-white">{p.code}</span>
                <span className="flex flex-1 flex-col justify-between gap-1 p-3">
                  <span className="font-semibold leading-tight">{p.name}</span>
                  <span className="font-bold tabular-nums">{money(p.price)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <aside className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col rounded-3xl border border-cz-border bg-cz-surface" aria-label="Venda atual" data-tour="pdv-venda">
        <div className="flex items-center justify-between border-b border-cz-border p-4">
          <h2 className="font-bold">Venda atual</h2>
          {items.length > 0 && (
            <Button size="sm" variant="ghost" className="text-cz-error" onClick={() => setItems([])}>
              <Trash2 className="size-4" aria-hidden /> Limpar
            </Button>
          )}
        </div>
        <ul className="min-h-40 flex-1 divide-y divide-cz-border overflow-y-auto" aria-live="polite">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{i.name}</p>
                {i.options.length > 0 && <p className="truncate text-xs text-cz-muted">{i.options.map((o) => o.name).join(", ")}</p>}
                <p className="text-sm tabular-nums text-cz-muted">{money(i.unitPrice)}</p>
              </div>
              <div className="flex items-center">
                <button type="button" aria-label={`Menos ${i.name}`} onClick={() => setItems((c) => c.flatMap((x) => (x.key === i.key ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])))} className="grid size-11 place-items-center rounded-full hover:bg-cz-surface-2">
                  <Minus className="size-4" aria-hidden />
                </button>
                <span className="w-7 text-center font-bold tabular-nums">{i.qty}</span>
                <button type="button" aria-label={`Mais ${i.name}`} onClick={() => setItems((c) => c.map((x) => (x.key === i.key ? { ...x, qty: x.qty + 1 } : x)))} className="grid size-11 place-items-center rounded-full hover:bg-cz-surface-2">
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
              <span className="w-20 text-right font-bold tabular-nums">{money(i.unitPrice * i.qty)}</span>
            </li>
          ))}
          {!items.length && <li className="p-8 text-center text-sm text-cz-muted">Toque nos produtos ou digite o código.</li>}
        </ul>
        <div className="grid gap-3 border-t border-cz-border p-4">
          <p className="flex items-baseline justify-between text-2xl font-extrabold">
            <span>Total</span>
            <span className="tabular-nums">{money(total)}</span>
          </p>
          <Button variant="brand" size="lg" disabled={!items.length} onClick={() => setPayOpen(true)} data-tour="pdv-finalizar">
            Finalizar (F4)
          </Button>
          {last && (
            <div className="flex items-center justify-between rounded-xl bg-cz-surface-2 p-2 pl-3 text-sm">
              <span>Última venda #{last.number}</span>
              <PrintButton order={last} tenant={tenant} label="Cupom" />
            </div>
          )}
        </div>
      </aside>

      <ProductModal
        product={modal}
        tenant={tenant}
        confirmLabel="Lançar"
        onClose={() => setModal(null)}
        onAdd={(it) => {
          setItems((c) => [...c, { ...it, key: uid() }]);
          setModal(null);
        }}
      />
      <PayModal open={payOpen} onOpenChange={setPayOpen} total={total} onFinish={finish} />
    </div>
  );
}

function PayModal({ open, onOpenChange, total, onFinish }: { open: boolean; onOpenChange: (v: boolean) => void; total: number; onFinish: (p: PaymentSplit[], change: number) => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Receber pagamento" description={`Total ${money(total)}`}>
      {open && <PayForm total={total} onFinish={onFinish} />}
    </Modal>
  );
}

function PayForm({ total, onFinish }: { total: number; onFinish: (p: PaymentSplit[], change: number) => void }) {
  const [payments, setPayments] = useState<PaymentSplit[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
  const remaining = round2(Math.max(0, total - paid));
  const [amount, setAmount] = useState(() => total.toFixed(2).replace(".", ","));
  const [people, setPeople] = useState(2);
  const amountRef = useRef<HTMLInputElement>(null);

  const value = Number(amount.replace(/\./g, "").replace(",", ".")) || 0;
  const cashChange = method === "dinheiro" ? changeDue(remaining, value) : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = METHODS.find((x) => x.key === e.key && e.altKey);
      if (m) {
        e.preventDefault();
        setMethod(m.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const add = () => {
    if (value <= 0) return toast.error("Informe o valor");
    if (method !== "dinheiro" && value > remaining + 0.001) return toast.error("Valor maior que o restante. Troco só em dinheiro.");
    const applied = Math.min(value, remaining);
    const next = [...payments, { method, amount: round2(applied), gateway: "presencial" as const }];
    const left = round2(total - next.reduce((s, p) => s + p.amount, 0));
    if (left <= 0.001) {
      onFinish(next, method === "dinheiro" ? cashChange : 0);
      return;
    }
    setPayments(next);
    setAmount(left.toFixed(2).replace(".", ","));
    amountRef.current?.focus();
  };

  const shares = splitEvenly(total, people);

  return (
    <div className="grid gap-5 p-5 pt-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Total" value={money(total)} />
        <Stat label="Pago" value={money(paid)} />
        <Stat label="Falta" value={money(remaining)} strong />
      </div>

      {payments.length > 0 && (
        <ul className="grid gap-1.5" aria-label="Pagamentos lançados">
          {payments.map((p, i) => (
            <li key={i} className="flex items-center justify-between rounded-xl bg-cz-surface-2 px-3 py-2 text-sm">
              <span>{LABEL[p.method]}</span>
              <span className="flex items-center gap-2 font-semibold tabular-nums">
                {money(p.amount)}
                <button type="button" aria-label={`Remover pagamento ${LABEL[p.method]}`} onClick={() => setPayments(payments.filter((_, j) => j !== i))} className="grid size-11 place-items-center rounded-full hover:bg-cz-surface-2">
                  <X className="size-4" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Forma (Alt + 1…5)</legend>
        <div className="grid grid-cols-5 gap-2" role="radiogroup">
          {METHODS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold", method === m.id ? "border-cz-navy bg-cz-navy text-white" : "border-cz-border")}>
              <m.icon className="size-5" aria-hidden />
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-1.5 text-sm font-semibold">
        {method === "dinheiro" ? "Valor recebido em dinheiro" : "Valor nesta forma"}
        <div className="flex gap-2">
          <input ref={amountRef} autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ""))} onKeyDown={(e) => e.key === "Enter" && add()} className="min-h-14 min-w-0 flex-1 rounded-xl border border-cz-border px-4 text-2xl font-bold tabular-nums" />
          <Button variant="brand" size="lg" onClick={add}>
            {value >= remaining - 0.001 ? "Concluir" : "Lançar parte"}
          </Button>
        </div>
      </label>
      {method === "dinheiro" && cashChange > 0 && (
        <p className="rounded-xl bg-cz-success/10 p-3 text-center text-lg font-bold text-cz-success" aria-live="polite">
          Troco: {money(cashChange)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {[remaining, Math.ceil(remaining / 10) * 10, Math.ceil(remaining / 50) * 50, 100].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => (
          <button key={v} type="button" onClick={() => setAmount(v.toFixed(2).replace(".", ","))} className="min-h-11 rounded-full border border-cz-border px-4 text-sm font-semibold tabular-nums hover:bg-cz-surface-2">
            {money(v)}
          </button>
        ))}
      </div>

      <details className="rounded-2xl border border-cz-border p-4">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
          <Divide className="size-4" aria-hidden /> Dividir conta por pessoa
        </summary>
        <div className="mt-3 grid gap-3">
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">
            Pessoas
            <input type="number" min={2} max={20} value={people} onChange={(e) => setPeople(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="min-h-11 w-24 rounded-xl border border-cz-border px-3 text-center" />
          </label>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {shares.map((s, i) => (
              <li key={i}>
                <button type="button" onClick={() => setAmount(s.toFixed(2).replace(".", ","))} className="flex min-h-11 w-full items-center justify-between rounded-xl bg-cz-surface-2 px-3 text-sm hover:bg-cz-surface-2">
                  <span>Pessoa {i + 1}</span> <b className="tabular-nums">{money(s)}</b>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-cz-muted">Toque numa pessoa para lançar a parte dela, na forma que ela escolher.</p>
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-xl p-3", strong ? "bg-cz-navy text-white" : "bg-cz-surface-2")}>
      <p className="text-xs">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
