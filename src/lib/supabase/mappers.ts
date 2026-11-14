// Conversão entre linhas do banco (snake_case) e os tipos do app. Pura: usada no servidor e no navegador.
import type { CartItem, Category, Order, OrderMode, OrderStatus, PaymentMethod, Product, Tenant } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any -- linhas vindas do PostgREST */
type Row = Record<string, any>;

export function tenantFromRow(r: Row, zones: Row[] = []): Tenant {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline ?? "",
    description: r.description ?? "",
    category: r.category ?? "",
    logo: r.logo_url ?? "",
    cover: r.cover_url ?? "",
    theme: r.theme,
    whatsapp: r.whatsapp ?? "",
    instagram: r.instagram ?? "",
    address: r.address ?? {},
    hours: r.hours ?? [],
    prepMinutes: r.prep_minutes ?? 15,
    // Preenchidos por getRealTenant a partir de tenant_rating (0 = menos de 10 avaliações, não exibir).
    rating: 0,
    ratingCount: 0,
    modes: r.modes ?? ["retirada"],
    deliveryZones: zones.map((z) => ({ id: z.id, bairro: z.bairro, fee: Number(z.fee), minutes: z.minutes })),
    deliveryPerKm: Number(r.delivery_per_km ?? 0),
    minOrder: Number(r.min_order ?? 0),
    tables: 12,
    subdomain: r.subdomain,
    plan: r.plan,
    active: r.active,
    createdAt: r.created_at,
    loyalty: r.loyalty ?? { enabled: false, goal: 10, reward: "", categoryIds: [], cashbackPct: 0 },
    isDemo: !!r.is_demo,
  };
}

export const categoryFromRow = (r: Row): Category => ({ id: r.id, tenantId: r.tenant_id, name: r.name, icon: r.icon, order: r.sort });

export function productFromRow(r: Row): Product {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    categoryId: r.category_id,
    code: r.code,
    name: r.name,
    description: r.description ?? "",
    badge: r.badge ?? undefined,
    price: Number(r.price),
    priceLabel: r.price_label ?? undefined,
    image: r.image_url ?? "",
    available: r.available,
    featured: r.featured,
    quickNotes: r.quick_notes ?? [],
    cake: r.cake ?? undefined,
    preorder: r.preorder ?? undefined,
    optionGroups: ((r.option_groups ?? []) as Row[])
      .sort((a, b) => a.sort - b.sort)
      .map((g) => ({
        id: g.id,
        name: g.name,
        min: g.min_select,
        max: g.max_select,
        choices: ((g.option_choices ?? []) as Row[]).sort((a, b) => a.sort - b.sort).map((c) => ({ id: c.id, name: c.name, price: Number(c.price) })),
      })),
  };
}

export function orderFromRow(r: Row): Order {
  const items: CartItem[] = ((r.order_items ?? []) as Row[]).map((i) => ({
    key: i.id,
    productId: i.product_id ?? "",
    name: i.name,
    image: "",
    unitPrice: Number(i.unit_price),
    qty: i.qty,
    options: i.options ?? [],
    notes: i.notes ?? "",
    cake: i.cake ?? undefined,
  }));
  const method = (r.payment_method ?? "dinheiro") as PaymentMethod;
  return {
    id: r.id,
    number: r.number,
    tenantId: r.tenant_id,
    channel: r.channel,
    mode: r.mode as OrderMode,
    status: r.status as OrderStatus,
    paymentStatus: r.payment_status,
    payments: [{ method, amount: Number(r.deposit ?? r.total) }],
    paymentMethod: method,
    gateway: r.gateway === "pix" ? "asaas" : "presencial",
    items,
    subtotal: Number(r.subtotal),
    deliveryFee: Number(r.delivery_fee),
    discount: Number(r.discount),
    total: Number(r.total),
    changeFor: r.change_for != null ? Number(r.change_for) : undefined,
    customer: { name: r.customer_name ?? "", phone: r.customer_phone ?? "" },
    address: r.address ?? undefined,
    table: r.table_number ?? undefined,
    scheduledFor: r.scheduled_for ?? undefined,
    deposit: r.deposit != null ? Number(r.deposit) : undefined,
    coupon: r.coupon_code ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    history: ((r.order_events ?? []) as Row[]).map((e) => ({ status: e.status, at: e.created_at })),
    seen: true,
  };
}

/** Select padrão de pedido com itens e histórico. */
export const ORDER_SELECT = "*, order_items(*), order_events(status, created_at)";
export const PRODUCT_SELECT = "*, option_groups(*, option_choices(*))";
