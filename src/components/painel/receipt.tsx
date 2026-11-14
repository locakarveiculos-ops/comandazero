"use client";

import { Printer } from "lucide-react";
import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import type { Order, Tenant } from "@/lib/types";
import { MODE_LABEL, fmtDateTime, money } from "@/lib/utils";

const PAY_LABEL: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
  dinheiro: "Dinheiro",
  vale_refeicao: "Vale-refeição",
  link: "Link",
};

/** Cupom não fiscal para impressora térmica 58 mm (32 colunas) ou 80 mm (48 colunas). */
export function Receipt({ order, tenant, width }: { order: Order; tenant: Tenant; width: 58 | 80 }) {
  const cols = width === 58 ? 32 : 48;
  const line = "-".repeat(cols);
  const pair = (a: string, b: string) => {
    const space = Math.max(1, cols - a.length - b.length);
    return a.length + b.length + 1 > cols ? `${a}\n${" ".repeat(Math.max(0, cols - b.length))}${b}` : a + " ".repeat(space) + b;
  };
  const center = (s: string) => " ".repeat(Math.max(0, Math.floor((cols - s.length) / 2))) + s;
  const wrap = (s: string, indent = "") => {
    const out: string[] = [];
    let cur = "";
    for (const w of s.split(" ")) {
      if ((cur + " " + w).trim().length > cols - indent.length) {
        out.push(indent + cur.trim());
        cur = w;
      } else cur += ` ${w}`;
    }
    if (cur.trim()) out.push(indent + cur.trim());
    return out.join("\n");
  };

  const rows = [
    center(tenant.name.toUpperCase()),
    ...(tenant.address.complement ? [wrap(tenant.address.complement)] : []),
    wrap(`${tenant.address.street} - ${tenant.address.city}/${tenant.address.uf}`),
    line,
    center(`PEDIDO #${order.number}`),
    center(`${MODE_LABEL[order.mode].toUpperCase()}${order.table ? ` - MESA ${order.table}` : ""}`),
    fmtDateTime(order.createdAt),
    order.customer.name ? `Cliente: ${order.customer.name}` : "",
    line,
    ...order.items.flatMap((i) => [
      pair(`${i.qty}x ${i.name}`.slice(0, cols - 11), money(i.unitPrice * i.qty)),
      ...i.options.map((o) => wrap(`+ ${o.name}`, "   ")),
      ...(i.cake?.kg ? [wrap(`${i.cake.kg}kg ${i.cake.massa} / ${i.cake.recheio}`, "   "), i.cake.frase ? wrap(`Frase: "${i.cake.frase}"`, "   ") : ""] : []),
      ...(i.notes ? [wrap(`Obs: ${i.notes}`, "   ")] : []),
    ]),
    line,
    pair("Subtotal", money(order.subtotal)),
    ...(order.deliveryFee ? [pair("Entrega", money(order.deliveryFee))] : []),
    ...(order.discount ? [pair("Desconto", `-${money(order.discount)}`)] : []),
    pair("TOTAL", money(order.total)),
    ...order.payments.map((p) => pair(PAY_LABEL[p.method] ?? p.method, money(p.amount))),
    ...(order.changeFor ? [pair("Troco para", money(order.changeFor)), pair("Troco", money(order.changeFor - order.total))] : []),
    ...(order.address ? [line, wrap(`${order.address.street}, ${order.address.number} ${order.address.complement ?? ""} - ${order.address.district}`)] : []),
    line,
    center("CUPOM NAO FISCAL"),
    center("Obrigado pela preferencia!"),
  ].filter((r) => r !== "");

  return (
    <pre
      className="print-area mx-auto bg-white p-3 font-mono leading-snug text-black shadow-md"
      style={{ width: `${width}mm`, fontSize: width === 58 ? "9.5px" : "11px", whiteSpace: "pre-wrap" }}
      aria-label={`Cupom do pedido ${order.number}`}
    >
      {rows.join("\n")}
    </pre>
  );
}

export function PrintButton({ order, tenant, label = "Imprimir" }: { order: Order; tenant: Tenant; label?: string }) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState<58 | 80>(80);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Printer className="size-4" aria-hidden /> {label}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title={`Cupom #${order.number}`} description="Pré-visualização para impressora térmica">
        <div className="grid gap-4 p-5">
          <div className="flex gap-2" role="radiogroup" aria-label="Largura do papel">
            {([58, 80] as const).map((w) => (
              <button key={w} type="button" role="radio" aria-checked={width === w} onClick={() => setWidth(w)} className={`min-h-11 flex-1 rounded-xl border font-semibold ${width === w ? "border-cz-navy bg-cz-navy text-white" : "border-black/15"}`}>
                {w} mm
              </button>
            ))}
          </div>
          <div className="max-h-[50vh] overflow-auto rounded-xl bg-ui-surface-2 p-4">
            <Receipt order={order} tenant={tenant} width={width} />
          </div>
          <Button variant="brand" size="lg" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Imprimir agora
          </Button>
        </div>
      </Modal>
    </>
  );
}
