"use client";

/* eslint-disable @next/next/no-img-element -- fotos podem vir de upload (data URL) do lojista */
import * as Icons from "lucide-react";
import { AtSign, Clock, MapPin, MessageCircle, Search, ShoppingBag, Star, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useMinute } from "@/lib/use-now";
import { toast } from "sonner";
import { InstallApp } from "@/components/loja/install-app";
import { StoreHelp } from "@/components/training/store-help";
import { ProductModal } from "@/components/loja/product-modal";
import { Checkout } from "@/components/loja/checkout";
import { useStoreTenant } from "@/components/loja/use-store-tenant";
import { TenantTheme, displayFont } from "@/components/tenant-theme";
import { Skeleton } from "@/components/ui";
import { addToCart, requestBill, useCart, useOrders, useDb } from "@/lib/repositories";
import { isRemote, useStoreMenu } from "@/lib/repositories/engine";
import type { OrderMode, Product } from "@/lib/types";
import { MODE_LABEL, STATUS_LABEL, cartSubtotal, cn, isOpenNow, money, todayHours } from "@/lib/utils";

const MODE_ICON: Record<string, string> = { delivery: "🛵", retirada: "🛍️", mesa: "🍽️", encomenda: "🎂" };
const MODE_HINT: Record<string, string> = {
  delivery: "Taxa por bairro",
  retirada: "Balcão / drive-thru",
  mesa: "Peça sem fila",
  encomenda: "Bolos e salgados",
};

export function StorePage({ slug }: { slug: string }) {
  const params = useSearchParams();
  const table = params.get("mesa")?.replace(/\D/g, "").padStart(2, "0").slice(-2) || undefined;
  const { tenant, notFound } = useStoreTenant(slug);
  const { categories, products } = useStoreMenu(tenant);
  const cart = useCart(tenant?.id ?? "");
  const customer = useDb((s) => s.customer);
  // Pedidos recentes deste aparelho: na loja real ficam guardados com o token (ver checkout).
  const myOrders = useOrders(isRemote(tenant) ? undefined : tenant?.id).filter((o) => customer && o.customer.phone.endsWith(customer.phone.replace(/\D/g, "").slice(-11)) && !["entregue", "cancelado"].includes(o.status));

  const [mode, setMode] = useState<OrderMode>(table ? "mesa" : "retirada");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>("");
  const [picked, setProduct] = useState<Product | null>(null);
  const [linkDismissed, setLinkDismissed] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const sections = useRef<Record<string, HTMLElement | null>>({});

  // Link do robô do WhatsApp (?item=) abre o produto direto.
  const linked = useMemo(() => {
    const id = params.get("item");
    return (id && products.find((x) => x.id === id && x.available)) || null;
  }, [params, products]);
  const product = picked ?? (linkDismissed ? null : linked);
  const closeProduct = () => {
    setProduct(null);
    setLinkDismissed(true);
  };

  const minute = useMinute();
  const open = tenant && minute ? isOpenNow(tenant.hours, new Date(minute)) : null;

  const visible = useMemo(() => {
    const q = query
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    return products.filter((p) => {
      // Encomendas têm fluxo próprio (data de retirada e sinal); só aparecem na aba Encomendas.
      const preorder = !!(p.cake || p.preorder);
      if ((mode === "encomenda") !== preorder) return false;
      if (!q) return true;
      return `${p.name} ${p.description}`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes(q);
    });
  }, [products, query, mode]);

  if (notFound)
    return (
      <main id="conteudo" className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Loja não encontrada</h1>
          <p className="mt-2 text-stone-600">Confira o endereço ou volte para a página inicial.</p>
          <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-stone-900 px-5 font-semibold text-white">
            Ir para o início
          </Link>
        </div>
      </main>
    );
  if (!tenant)
    return (
      <div className="grid gap-4 p-4">
        <Skeleton className="h-56" />
        <Skeleton className="h-24" />
      </div>
    );

  const items = cart.reduce((n, i) => n + i.qty, 0);
  const subtotal = cartSubtotal(cart);
  const featured = products.filter((p) => p.featured && p.available).slice(0, 6);
  const modes = tenant.modes.filter((m) => m !== "mesa" || table);

  const add = (item: Parameters<typeof addToCart>[1]) => {
    addToCart(tenant.id, item);
    closeProduct();
    toast.success(`${item.name} no carrinho`, { action: { label: "Ver carrinho", onClick: () => setCartOpen(true) } });
  };

  const scrollTo = (id: string) => {
    setActive(id);
    sections.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <TenantTheme tenant={tenant} className="min-h-screen pb-28">
      <header className="relative">
        <div className="h-44 w-full overflow-hidden sm:h-60">
          <img src={tenant.cover} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 h-44 bg-gradient-to-b from-black/10 via-black/20 to-black/60 sm:h-60" aria-hidden />
        </div>
        <div className="mx-auto -mt-16 max-w-5xl px-4">
          <div className="relative rounded-3xl border border-line bg-surface p-5 shadow-xl shadow-black/10">
            <div className="flex flex-wrap items-start gap-4">
              <img src={tenant.logo} alt={`Logo ${tenant.name}`} className="-mt-12 size-24 shrink-0 rounded-full border-4 border-surface bg-surface object-cover shadow-lg" />
              <div className="min-w-0 flex-1">
                <h1 className={cn("text-3xl font-bold leading-tight text-ink sm:text-4xl", displayFont(tenant))}>{tenant.name}</h1>
                <p className="mt-0.5 text-sm text-muted">{tenant.tagline}</p>
              </div>
              <div className="flex items-center gap-2">
                <StoreHelp slug={slug} />
                <InstallApp tenant={tenant} />
              </div>
            </div>
            <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink">
              <li className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-full", open === null ? "bg-stone-400" : open ? "bg-emerald-500" : "bg-red-500")} aria-hidden />
                <b>{open === null ? "…" : open ? "Aberto agora" : "Fechado agora"}</b>
                <span className="text-muted">· hoje {todayHours(tenant)}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Clock className="size-4 text-muted" aria-hidden /> ~{tenant.prepMinutes} min de preparo
              </li>
              <li className="flex items-center gap-1.5">
                <Star className="size-4 fill-highlight text-highlight" aria-hidden />
                <b>{tenant.rating.toLocaleString("pt-BR")}</b>
                <span className="text-muted">({tenant.ratingCount} avaliações)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <MapPin className="size-4 text-muted" aria-hidden />
                <span>{tenant.address.complement ?? `${tenant.address.street}, ${tenant.address.district}`}</span>
              </li>
            </ul>
            {table && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/10 p-3 text-sm text-ink">
                <p className="flex items-center gap-2">
                  <UtensilsCrossed className="size-4" aria-hidden /> Você está na <b>mesa {table}</b>. Peça direto daqui, sem fila.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    requestBill(tenant.id, table);
                    toast.success("Pedimos a conta! Um atendente já vem até você.");
                  }}
                  className="min-h-11 rounded-full border border-ink/30 px-4 font-semibold"
                >
                  Pedir a conta
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-5xl px-4">
        {myOrders.length > 0 && (
          <div className="mt-5 grid gap-2">
            {myOrders.slice(0, 2).map((o) => (
              <Link key={o.id} href={`/loja/${slug}/pedido/${o.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 text-sm text-ink">
                <span>
                  Pedido <b>#{o.number}</b> · {STATUS_LABEL[o.status]}
                </span>
                <span className="font-semibold text-accent-text">Acompanhar →</span>
              </Link>
            ))}
          </div>
        )}

        <nav aria-label="Como você quer pedir" className="mt-6" data-tour="loja-modos">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup">
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex min-h-14 shrink-0 items-center gap-2.5 rounded-2xl border px-4 text-left transition",
                  mode === m ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink hover:border-ink/40",
                )}
              >
                <span className="text-xl" aria-hidden>
                  {MODE_ICON[m]}
                </span>
                <span>
                  <span className="block text-sm font-bold">{m === "mesa" ? `Mesa ${table}` : MODE_LABEL[m]}</span>
                  <span className={cn("block text-xs", mode === m ? "opacity-85" : "text-muted")}>{MODE_HINT[m]}</span>
                </span>
              </button>
            ))}
          </div>
        </nav>

        <div className="sticky top-0 z-20 -mx-4 mt-4 bg-paper/95 px-4 pb-2 pt-3 backdrop-blur">
          <label className="relative block" data-tour="loja-busca">
            <span className="sr-only">Buscar no cardápio</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar café, bolo, croissant…"
              className="min-h-12 w-full rounded-full border border-line bg-surface pl-11 pr-4 text-base text-ink placeholder:text-muted"
            />
          </label>
          {mode !== "encomenda" && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {categories
                .filter((c) => visible.some((p) => p.categoryId === c.id))
                .map((c) => {
                  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[c.icon] ?? Icons.Utensils;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => scrollTo(c.id)}
                      aria-current={active === c.id ? "true" : undefined}
                      className={cn("flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold", active === c.id ? "bg-ink text-paper" : "bg-surface text-ink ring-1 ring-line")}
                    >
                      <Icon className="size-4" aria-hidden />
                      {c.name}
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {!query && mode !== "encomenda" && featured.length > 0 && (
          <section className="mt-6" aria-labelledby="destaques" data-tour="loja-destaques">
            <h2 id="destaques" className={cn("text-2xl font-bold text-ink", displayFont(tenant))}>
              Destaques da casa
            </h2>
            <div className="no-scrollbar -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
              {featured.map((p) => (
                <button key={p.id} type="button" onClick={() => setProduct(p)} className="group w-60 shrink-0 snap-start overflow-hidden rounded-3xl border border-line bg-surface text-left">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img src={p.image} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                  </div>
                  <div className="p-4">
                    {p.badge && <p className="text-[11px] font-bold uppercase tracking-wider text-accent-text">{p.badge}</p>}
                    <p className="font-bold leading-tight text-ink">{p.name}</p>
                    <p className="mt-1 font-semibold tabular-nums text-ink">{p.priceLabel ?? money(p.price)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {categories.map((c) => {
          const list = visible.filter((p) => p.categoryId === c.id);
          if (!list.length) return null;
          return (
            <section key={c.id} ref={(el) => void (sections.current[c.id] = el)} className="mt-8 scroll-mt-36" aria-labelledby={`cat-${c.id}`}>
              <h2 id={`cat-${c.id}`} className={cn("text-2xl font-bold text-ink", displayFont(tenant))}>
                {c.name}
              </h2>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {list.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => (p.available ? setProduct(p) : toast.info(`${p.name} esgotou por hoje.`))}
                      aria-disabled={!p.available}
                      className={cn("flex w-full gap-4 rounded-3xl border border-line bg-surface p-3 text-left transition hover:border-ink/30", !p.available && "opacity-60")}
                    >
                      <div className="min-w-0 flex-1 py-1">
                        <p className="font-bold leading-snug text-ink">{p.name}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>
                        <p className="mt-2 font-semibold tabular-nums text-ink">
                          {p.available ? (p.priceLabel ?? money(p.price)) : <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-bold uppercase">Esgotado</span>}
                        </p>
                      </div>
                      <img src={p.image} alt="" loading="lazy" className="size-28 shrink-0 rounded-2xl object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {visible.length === 0 && <p className="mt-10 text-center text-muted">Nada encontrado para “{query}”.</p>}

        <footer className="mt-14 grid gap-3 border-t border-line pt-6 text-sm text-muted">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {tenant.address.complement && (
                <>
                  {tenant.address.complement}
                  <br />
                </>
              )}
              {tenant.address.street} · {tenant.address.district} · {tenant.address.city}-{tenant.address.uf} · CEP {tenant.address.cep}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={`https://wa.me/${tenant.whatsapp}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 font-semibold text-ink ring-1 ring-line">
              <MessageCircle className="size-4" aria-hidden /> WhatsApp
            </a>
            <a href={`https://instagram.com/${tenant.instagram}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 font-semibold text-ink ring-1 ring-line">
              <AtSign className="size-4" aria-hidden /> @{tenant.instagram}
            </a>
          </div>
          <p className="text-xs">Cardápio digital da loja · tecnologia ComandaZero</p>
        </footer>
      </main>

      {items > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-4">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="mx-auto flex min-h-14 w-full max-w-xl items-center justify-between gap-3 rounded-full bg-primary px-5 font-bold text-primary-ink shadow-2xl shadow-black/30"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="size-5" aria-hidden />
              Ver carrinho <span className="rounded-full bg-primary-ink/20 px-2 text-sm">{items}</span>
            </span>
            <span className="tabular-nums">{money(subtotal)}</span>
          </button>
        </div>
      )}

      <ProductModal product={product} tenant={tenant} onClose={closeProduct} onAdd={add} />
      <Checkout tenant={tenant} mode={mode} table={table} open={cartOpen} onOpenChange={setCartOpen} />
    </TenantTheme>
  );
}
