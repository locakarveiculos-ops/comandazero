import type { CakeOrder, CartItemOption, Coupon, Product } from "./types";
import { round2 } from "./utils";

export type Selections = Record<string, string[]>; // groupId -> choiceIds

export function validateSelections(product: Product, sel: Selections): string[] {
  const errors: string[] = [];
  for (const g of product.optionGroups) {
    const n = sel[g.id]?.length ?? 0;
    if (n < g.min) errors.push(g.min === 1 ? `Escolha ${g.name.toLowerCase()}` : `Escolha ao menos ${g.min} em ${g.name}`);
    if (n > g.max) errors.push(`Máximo de ${g.max} em ${g.name}`);
  }
  return errors;
}

export function selectedOptions(product: Product, sel: Selections): CartItemOption[] {
  return product.optionGroups.flatMap((g) =>
    (sel[g.id] ?? []).flatMap((cid) => {
      const c = g.choices.find((x) => x.id === cid);
      return c ? [{ groupId: g.id, groupName: g.name, choiceId: c.id, name: c.name, price: c.price }] : [];
    }),
  );
}

export const cakePrice = (kg: number, pricePerKg: number) => round2(kg * pricePerKg);

export function unitPrice(product: Product, sel: Selections, cake?: Pick<CakeOrder, "kg">) {
  const base = product.cake && cake ? cakePrice(cake.kg, product.cake.pricePerKg) : product.price;
  return round2(base + selectedOptions(product, sel).reduce((s, o) => s + o.price, 0));
}

// Data mínima de retirada respeitando a antecedência exigida pela encomenda.
export function earliestPickup(leadHours: number, now = new Date()) {
  const d = new Date(now.getTime() + leadHours * 3600000);
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0);
  return d;
}

export function couponError(coupon: Coupon | undefined, subtotal: number): string | null {
  if (!coupon || !coupon.active) return "Cupom inválido ou expirado";
  if (subtotal < coupon.minOrder) return `Válido para pedidos a partir de R$ ${coupon.minOrder.toFixed(2).replace(".", ",")}`;
  return null;
}

export function couponDiscount(coupon: Coupon | undefined, subtotal: number, deliveryFee: number) {
  if (!coupon || couponError(coupon, subtotal)) return 0;
  if (coupon.type === "percent") return round2((subtotal * coupon.value) / 100);
  if (coupon.type === "fixed") return round2(Math.min(coupon.value, subtotal));
  return deliveryFee;
}

export const changeDue = (total: number, paid: number) => round2(Math.max(0, paid - total));

// Divide um valor em N partes sem perder centavos (o resto vai para as primeiras).
export function splitEvenly(total: number, people: number) {
  const n = Math.max(1, Math.floor(people));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const rest = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rest ? 1 : 0)) / 100);
}
