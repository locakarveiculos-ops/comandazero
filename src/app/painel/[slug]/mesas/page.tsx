"use client";

/* eslint-disable @next/next/no-img-element -- QR gerado em data URL */
import { ArrowRightLeft, Clock, Plus, Printer, QrCode, Receipt as ReceiptIcon, Trash2, Users } from "lucide-react";
import { useOrigin } from "@/lib/use-client";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useStoreTenant } from "@/components/loja/use-store-tenant";
import { ProductModal } from "@/components/loja/product-modal";
import { Badge, Button, Modal, Select } from "@/components/ui";
import { addToTable, closeTable, createOrder, openTable, removeTableItem, requestBill, transferTable, useMenu, useTables } from "@/lib/repositories";
import type { Product, TableTab, Tenant } from "@/lib/types";
import { useMinute } from "@/lib/use-now";
import { cartSubtotal, cn, elapsedMinutes, money, round2, uid } from "@/lib/utils";

const STATE = {
  livre: { label: "Livre", cls: "border-[#16845b]/45 bg-cz-success/10", tone: "green" as const },
  ocupada: { label: "Ocupada", cls: "border-[#2563a6]/45 bg-[#2563a6]/10", tone: "blue" as const },
  conta: { label: "Conta solicitada", cls: "border-[#a96116]/60 bg-[#a96116]/12 flash-new", tone: "amber" as const },
};

export default function MesasPage() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant } = useStoreTenant(slug);
  const tables = useTables(tenant?.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const now = useMinute();

  if (!tenant) return null;
  const table = tables.find((t) => t.number === selected) ?? null;
  const counts = { livre: 0, ocupada: 0, conta: 0, ...Object.fromEntries(["livre", "ocupada", "conta"].map((s) => [s, tables.filter((t) => t.state === s).length])) };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="cz-heading text-2xl font-bold">Mapa de mesas</h1>
          <p className="text-sm text-cz-muted">
            {counts.livre} livres · {counts.ocupada} ocupadas · {counts.conta} pedindo conta
          </p>
        </div>
        <Button variant="secondary" onClick={() => setQrOpen(true)}>
          <QrCode className="size-4" aria-hidden /> QR Codes das mesas
        </Button>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {tables.map((t) => {
          const s = STATE[t.state];
          const total = cartSubtotal(t.items);
          return (
            <li key={t.number}>
              <button type="button" onClick={() => setSelected(t.number)} className={cn("flex min-h-36 w-full flex-col justify-between rounded-2xl border-2 p-4 text-left transition hover:shadow-md", s.cls)}>
                <span className="flex items-start justify-between gap-2">
                  <span className="cz-heading text-3xl font-bold">{t.number}</span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </span>
                {t.state === "livre" ? (
                  <span className="text-sm text-cz-muted">Toque para abrir</span>
                ) : (
                  <span className="grid gap-0.5 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5" aria-hidden /> {t.openedAt ? `${elapsedMinutes(t.openedAt, now)} min` : "—"}
                      <Users className="ml-2 size-3.5" aria-hidden /> {t.people}
                    </span>
                    <span className="text-lg font-bold tabular-nums">{money(total)}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <TableDrawer tenant={tenant} table={table} tables={tables} onClose={() => setSelected(null)} />
      <QrSheet open={qrOpen} onOpenChange={setQrOpen} tenant={tenant} tables={tables} />
    </div>
  );
}

function TableDrawer({ tenant, table, tables, onClose }: { tenant: Tenant; table: TableTab | null; tables: TableTab[]; onClose: () => void }) {
  const { products } = useMenu(tenant.id);
  const [adding, setAdding] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [serviceFee, setServiceFee] = useState(true);
  const quick = useMemo(() => products.filter((p) => p.available && !p.cake && !p.preorder), [products]);

  if (!table) return null;
  const subtotal = cartSubtotal(table.items);
  const fee = serviceFee ? round2(subtotal * 0.1) : 0;
  const total = round2(subtotal + fee);

  const close = () => {
    // Itens pedidos pelo QR já são pedidos próprios; aqui só fatura o que o garçom lançou + serviço.
    const waiterItems = table.items.filter((i) => !i.orderId);
    const billed = [
      ...waiterItems,
      ...(fee > 0 ? [{ key: uid(), productId: "servico", name: "Serviço (10%)", image: "", unitPrice: fee, qty: 1, options: [], notes: "" }] : []),
    ];
    if (waiterItems.length || fee > 0) {
      const amount = cartSubtotal(billed);
      createOrder({
        tenantId: tenant.id,
        channel: "mesa",
        mode: "mesa",
        items: billed,
        payments: [{ method: "cartao_debito", amount }],
        gateway: "presencial",
        paid: true,
        customer: { name: `Mesa ${table.number}`, phone: "" },
        table: table.number,
      });
    }
    closeTable(tenant.id, table.number);
    toast.success(`Mesa ${table.number} fechada · ${money(total)}`);
    onClose();
  };

  return (
    <Modal open={!!table} onOpenChange={(v) => !v && onClose()} title={`Mesa ${table.number}`} description={STATE[table.state].label} side="right">
      <div className="grid gap-5 p-5">
        {table.state === "livre" ? (
          <Button variant="brand" size="lg" onClick={() => openTable(tenant.id, table.number)}>
            Abrir mesa
          </Button>
        ) : (
          <>
            <ul className="grid gap-2" aria-label="Itens da comanda">
              {table.items.map((i) => (
                <li key={i.key} className="flex items-center gap-2 rounded-xl bg-cz-surface-2 p-3 text-sm">
                  <span className="flex-1">
                    <b>{i.qty}×</b> {i.name}
                    {i.orderId && <Badge tone="blue" className="ml-1.5">via QR</Badge>}
                    {i.options.length > 0 && <span className="block text-xs text-cz-muted">{i.options.map((o) => o.name).join(", ")}</span>}
                  </span>
                  <span className="tabular-nums">{money(i.unitPrice * i.qty)}</span>
                  <button type="button" aria-label={`Remover ${i.name}`} onClick={() => removeTableItem(tenant.id, table.number, i.key)} className="grid size-11 place-items-center rounded-full text-cz-error hover:bg-cz-error/10">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
              {!table.items.length && <li className="rounded-xl border border-dashed border-cz-border p-6 text-center text-sm text-cz-muted">Comanda vazia</li>}
            </ul>

            {adding ? (
              <div className="grid gap-2">
                <p className="text-sm font-semibold">Adicionar item</p>
                <ul className="grid max-h-64 gap-1.5 overflow-y-auto">
                  {quick.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (p.optionGroups.some((g) => g.min > 0)) return setProduct(p);
                          addToTable(tenant.id, table.number, [{ key: uid(), productId: p.id, name: p.name, image: p.image, unitPrice: p.price, qty: 1, options: [], notes: "" }]);
                        }}
                        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-cz-border px-3 text-sm hover:bg-cz-surface-2"
                      >
                        <span>
                          <span className="mr-2 font-mono text-xs text-cz-muted">{p.code}</span>
                          {p.name}
                        </span>
                        <span className="tabular-nums">{money(p.price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" onClick={() => setAdding(false)}>
                  Concluir
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setAdding(true)}>
                <Plus className="size-4" aria-hidden /> Adicionar itens
              </Button>
            )}

            <div className="grid gap-2 rounded-2xl bg-cz-surface-2 p-4 text-sm">
              <p className="flex justify-between">
                <span>Consumo</span>
                <span className="tabular-nums">{money(subtotal)}</span>
              </p>
              <label className="flex min-h-11 items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={serviceFee} onChange={(e) => setServiceFee(e.target.checked)} className="size-5" /> Serviço 10% (opcional)
                </span>
                <span className="tabular-nums">{money(fee)}</span>
              </label>
              <p className="flex justify-between border-t border-cz-border pt-2 text-lg font-bold">
                <span>Total</span>
                <span className="tabular-nums">{money(total)}</span>
              </p>
              {table.people > 1 && <p className="text-cz-muted">Por pessoa ({table.people}): {money(round2(total / table.people))}</p>}
            </div>

            <div className="flex items-end gap-2">
              <label className="grid flex-1 gap-1 text-sm font-semibold">
                Transferir para
                <Select value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                  <option value="">Escolha a mesa</option>
                  {tables
                    .filter((t) => t.number !== table.number)
                    .map((t) => (
                      <option key={t.number} value={t.number}>
                        Mesa {t.number} {t.state !== "livre" ? "(juntar)" : ""}
                      </option>
                    ))}
                </Select>
              </label>
              <Button
                variant="secondary"
                disabled={!transferTo}
                onClick={() => {
                  transferTable(tenant.id, table.number, transferTo);
                  toast.success(`Mesa ${table.number} transferida para ${transferTo}`);
                  onClose();
                }}
              >
                <ArrowRightLeft className="size-4" aria-hidden /> Transferir
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => requestBill(tenant.id, table.number)} disabled={table.state === "conta"}>
                <ReceiptIcon className="size-4" aria-hidden /> Pedir conta
              </Button>
              <Button variant="brand" onClick={close}>
                Fechar mesa
              </Button>
            </div>
          </>
        )}
      </div>
      <ProductModal
        product={product}
        tenant={tenant}
        confirmLabel="Lançar na mesa"
        onClose={() => setProduct(null)}
        onAdd={(it) => {
          addToTable(tenant.id, table.number, [{ ...it, key: uid() }]);
          setProduct(null);
        }}
      />
    </Modal>
  );
}

function QrSheet({ open, onOpenChange, tenant, tables }: { open: boolean; onOpenChange: (v: boolean) => void; tenant: Tenant; tables: TableTab[] }) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const origin = useOrigin();
  const tableKey = tables.map((t) => t.number).join(",");
  useEffect(() => {
    if (!open) return;
    let alive = true;
    Promise.all(tableKey.split(",").map(async (n) => [n, await QRCode.toDataURL(`${origin}/loja/${tenant.slug}?mesa=${n}`, { margin: 1, width: 360 })] as const)).then((pairs) => {
      if (alive) setCodes(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [open, tableKey, origin, tenant.slug]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="QR Codes das mesas" description="O cliente aponta a câmera e pede direto para a mesa." className="max-w-4xl">
      <div className="grid gap-4 p-5">
        <Button variant="brand" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> Imprimir todos
        </Button>
        <ul className="print-area grid grid-cols-2 gap-4 bg-cz-surface sm:grid-cols-3">
          {tables.map((t) => (
            <li key={t.number} className="grid place-items-center gap-1 rounded-2xl border-2 border-dashed border-cz-border p-4 text-center" style={{ breakInside: "avoid" }}>
              <p className="font-serif text-lg font-bold">{tenant.name}</p>
              {codes[t.number] ? <img src={codes[t.number]} alt={`QR Code da mesa ${t.number}`} className="size-36" /> : <div className="size-36 animate-pulse rounded bg-cz-border" />}
              <p className="text-2xl font-extrabold">Mesa {t.number}</p>
              <p className="text-xs text-cz-muted">Aponte a câmera e peça sem fila</p>
              <p className="break-all text-[10px] text-cz-muted">{`${origin}/loja/${tenant.slug}?mesa=${t.number}`}</p>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
