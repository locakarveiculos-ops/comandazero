"use client";

/* eslint-disable @next/next/no-img-element -- logos SVG oficiais e fotos do cardápio de demonstração */
import {
  ArrowRight,
  BadgePercent,
  Bike,
  ChefHat,
  CreditCard,
  LayoutDashboard,
  MessageSquareMore,
  MonitorSmartphone,
  QrCode,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BrandLogo, SaasSurface, ThemeToggle, useSaasTheme } from "@/components/brand-switcher";
import { saasBrand } from "@/config/saas-brand";
import { money } from "@/lib/utils";

const MODULES = [
  { icon: MonitorSmartphone, title: "PDV de balcão", text: "Atalhos de teclado, busca por código, divisão de conta e pagamento misto para o horário de pico." },
  { icon: ChefHat, title: "KDS da cozinha", text: "Fila, preparo e pronto em tela cheia, com cronômetro por cor e alerta sonoro a cada pedido." },
  { icon: MessageSquareMore, title: "WhatsApp com botões", text: "Confirmação de pedido com botões, cardápio em lista e aviso automático de cada etapa." },
  { icon: Bike, title: "Delivery e retirada", text: "Taxa por bairro, busca de CEP, agendamento de retirada e encomendas com sinal." },
  { icon: Smartphone, title: "App com a marca da loja", text: "Cada estabelecimento tem o próprio app instalável, com nome, ícone e cores dele." },
  { icon: CreditCard, title: "Pagamentos", text: "Pix com QR na hora e confirmação automática. InfinitePay, Asaas, Mercado Pago, PagBank e Stone." },
  { icon: QrCode, title: "Mesas por QR Code", text: "O cliente aponta a câmera e pede direto para a mesa. Garçom vê a comanda em tempo real." },
  { icon: BadgePercent, title: saasBrand.marketingClaim, text: "Assinatura fixa. A plataforma não cobra percentual sobre as vendas; taxas de gateway seguem as do seu contrato." },
];

const STEPS = [
  ["Cadastre a loja", "Nome, cores e logo. O app da loja fica no ar na hora."],
  ["Monte o cardápio", "Produtos, complementos, fotos e encomendas programadas."],
  ["Conecte WhatsApp e Pix", "Lê o QR do WhatsApp e escolhe o gateway de pagamento."],
  ["Imprima os QR das mesas", "E comece a receber pedidos no balcão, na mesa e no delivery."],
];

export function Landing() {
  const theme = useSaasTheme();
  const dark = theme === "dark";
  return (
    <SaasSurface>
      <header className="sticky top-0 z-40 border-b border-cz-border bg-cz-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" aria-label={`${saasBrand.name}, início`}>
            <BrandLogo variant="compact" height={34} onDark={dark} />
          </Link>
          <nav aria-label="Principal" className="ml-auto hidden items-center gap-1 text-sm font-medium md:flex">
            {[
              ["#modulos", "Módulos"],
              ["#como-funciona", "Como funciona"],
              ["#economia", "Economia"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="inline-flex min-h-11 items-center rounded-[10px] px-3 hover:bg-cz-surface-2">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <ThemeToggle />
            <Link href="/entrar" className="hidden min-h-11 items-center rounded-[10px] bg-brand px-4 text-sm font-semibold text-brand-ink hover:opacity-90 sm:inline-flex">
              Entrar no painel
            </Link>
          </div>
        </div>
      </header>

      <main id="conteudo">
        {/* Hero institucional navy: único lugar com o logo completo e o slogan em destaque. */}
        <section className="relative overflow-hidden bg-cz-navy text-[#faf8f5]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#d4af6b 1px, transparent 1px)", backgroundSize: "22px 22px" }} aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:pt-20">
            <div>
              <BrandLogo variant="slogan" height={64} onDark className="mb-8" />
              <h1 className="cz-heading text-4xl font-bold leading-[1.08] sm:text-5xl">
                Pedidos, balcão e cozinha da sua loja <span className="text-cz-gold">em um só lugar.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-[#c5cbd5]">
                Para cafeterias, padarias, confeitarias e lanchonetes. Cardápio digital com a marca da sua loja, PDV rápido, mesas por QR Code, tela da cozinha e WhatsApp com botões.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/loja/cafe-e-flor" className="inline-flex min-h-12 items-center gap-2 rounded-[10px] bg-cz-gold px-6 font-semibold text-cz-navy hover:brightness-105">
                  Ver loja demo: Café e Flor <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link href="/loja/burger-station" className="inline-flex min-h-12 items-center gap-2 rounded-[10px] border border-white/25 px-6 font-semibold text-white hover:bg-white/10">
                  Demo 2: Burger Station
                </Link>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
                {[
                  ["/painel/cafe-e-flor", "Painel do lojista", LayoutDashboard],
                  ["/painel/cafe-e-flor/kds", "KDS cozinha", ChefHat],
                ].map(([href, label, Icon]) => {
                  const I = Icon as typeof ChefHat;
                  return (
                    <li key={href as string}>
                      <Link href={href as string} className="inline-flex min-h-11 items-center gap-1.5 text-[#e8dcc8] underline-offset-4 hover:underline">
                        <I className="size-4" aria-hidden /> {label as string}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            <Devices />
          </div>
        </section>

        <section className="border-b border-cz-border bg-cz-surface">
          <p className="mx-auto max-w-6xl px-4 py-5 text-sm text-cz-muted">
            <b className="text-cz-text">Veja o tempo real:</b> abra o cardápio numa aba e o{" "}
            <Link className="font-semibold text-cz-gold-text underline underline-offset-2" href="/painel/cafe-e-flor/pedidos">
              painel de pedidos
            </Link>{" "}
            em outra. Faça um pedido e ele chega piscando, com som.
          </p>
        </section>

        <section id="modulos" className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-cz-gold-text">Módulos</p>
            <h2 className="cz-heading mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">Tudo que o balcão precisa no horário de pico</h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MODULES.map((m) => (
                <li key={m.title} className="rounded-[14px] border border-cz-border bg-cz-surface p-5">
                  <span className="grid size-11 place-items-center rounded-[10px] bg-cz-navy text-cz-gold">
                    <m.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-semibold">{m.title}</h3>
                  <p className="mt-1 text-sm text-cz-muted">{m.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="como-funciona" className="border-y border-cz-border bg-cz-surface py-20">
          <div className="mx-auto max-w-6xl px-4">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-cz-gold-text">Onboarding</p>
            <h2 className="cz-heading mt-2 text-3xl font-bold sm:text-4xl">Do cadastro ao primeiro pedido</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-4">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="relative pl-14 md:pl-0 md:pt-14">
                  <span className="cz-heading absolute left-0 top-0 grid size-11 place-items-center rounded-full border-2 border-cz-gold text-lg font-bold">{i + 1}</span>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-cz-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Savings />
      </main>

      <footer className="bg-cz-navy py-10 text-[#c5cbd5]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm">
          <BrandLogo variant="slogan" height={40} onDark />
          <p>Taxas de gateways de pagamento não fazem parte da assinatura.</p>
        </div>
      </footer>
    </SaasSurface>
  );
}

function Devices() {
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-xl sm:h-[470px]" aria-label="O sistema rodando no monitor da cozinha, no tablet do balcão e no celular do cliente" role="img">
      <div className="absolute right-0 top-0 w-[88%] rounded-[14px] border-[6px] border-[#1b3156] bg-[#08162d] p-3 shadow-2xl">
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#c5cbd5]">
          <span>KDS · Cozinha</span>
          <span className="flex gap-1">
            <i className="size-2 rounded-full bg-[#16845b]" />
            <i className="size-2 rounded-full bg-[#e0a43a]" />
            <i className="size-2 rounded-full bg-[#b43838]" />
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["#1042", "4 min", "bg-[#16845b] text-white", "2× Cappuccino", "1× Croissant 4 queijos"],
            ["#1039", "13 min", "bg-[#e0a43a] text-[#2b1a05]", "1× Espresso & Misto", "⚠ pão bem tostado"],
            ["#1035", "22 min", "bg-[#b43838] text-white", "Bolo de festa 2,5 kg", "Retirada 16h"],
          ].map(([n, t, c, a, b]) => (
            <div key={n} className="overflow-hidden rounded-lg bg-[#faf8f5] text-[#0b1f40]">
              <div className={`flex justify-between px-2 py-1 text-[10px] font-bold ${c}`}>
                <span>{n}</span>
                <span>{t}</span>
              </div>
              <p className="px-2 pt-1 text-[10px] font-semibold">{a}</p>
              <p className="px-2 pb-2 text-[9px] text-[#526076]">{b}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-6 left-0 w-[62%] rounded-[22px] border-[8px] border-[#1b3156] bg-white p-2.5 shadow-2xl">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#526076]">PDV Balcão</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {["1572442388796-11668a67e53d", "1555507036-ab1f4038808a", "1578985545062-69928b1d9587", "1509365465985-25d11c17e812", "1600271886742-f049cd451bba", "1514432324607-a09d9b4aefdd"].map((id) => (
            <img key={id} src={`https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=160&q=60`} alt="" className="aspect-square w-full rounded-md object-cover" />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between rounded-lg bg-[#0b1f40] px-2 py-1.5 text-[11px] font-bold text-white">
          <span>Finalizar F4</span>
          <span>R$ 47,30</span>
        </div>
      </div>
      {/* Celular com a marca da loja (white-label), não da plataforma. */}
      <div className="absolute bottom-0 right-6 w-[34%] min-w-36 rounded-[28px] border-[7px] border-[#1b3156] bg-[#FAF6F0] shadow-2xl">
        <div className="overflow-hidden rounded-[21px]">
          <img src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=300&q=60" alt="" className="h-16 w-full object-cover" />
          <div className="p-2">
            <img src="/tenants/cafe-e-flor/logo.webp" alt="" className="-mt-7 size-10 rounded-full border-2 border-[#FAF6F0]" />
            <p className="font-serif text-[13px] font-bold text-[#2C1A12]">Café e Flor</p>
            <p className="text-[8px] text-[#6B5246]">Cafeteria artesanal · aberto</p>
            {["Cappuccino", "Croissant", "Bolo de banana"].map((n) => (
              <div key={n} className="mt-1 flex items-center justify-between rounded-md border border-[#EADCCD] bg-white px-1.5 py-1 text-[9px] text-[#2C1A12]">
                {n} <span className="font-bold">+</span>
              </div>
            ))}
            <div className="mt-1.5 rounded-full bg-[#2C1A12] py-1 text-center text-[9px] font-bold text-[#FAF6F0]">Ver carrinho</div>
          </div>
        </div>
      </div>
      <span className="absolute left-4 top-6 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#0b1f40] shadow-lg">
        <Bike className="size-3.5 text-[#8a5c21]" aria-hidden /> Pedido #1043 chegou
      </span>
    </div>
  );
}

function Savings() {
  const [orders, setOrders] = useState(600);
  const [ticket, setTicket] = useState(38);
  const [rate, setRate] = useState(23);
  const [plan, setPlan] = useState(179);
  const gmv = orders * ticket;
  const fee = (gmv * rate) / 100;
  const save = Math.max(0, fee - plan);

  return (
    <section id="economia" className="py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-cz-gold-text">Calculadora</p>
          <h2 className="cz-heading mt-2 text-3xl font-bold sm:text-4xl">Quanto o marketplace leva por mês?</h2>
          <p className="mt-2 text-cz-muted">Compare a comissão do app de delivery com uma assinatura fixa. Ajuste os valores à sua realidade.</p>
          <div className="mt-8 grid gap-6">
            <Slider label="Pedidos por mês" value={orders} min={50} max={3000} step={50} onChange={setOrders} format={(v) => String(v)} />
            <Slider label="Ticket médio" value={ticket} min={15} max={150} step={1} onChange={setTicket} format={money} />
            <Slider label="Comissão + taxa do marketplace" value={rate} min={12} max={30} step={0.5} onChange={setRate} format={(v) => `${v.toLocaleString("pt-BR")}%`} />
            <Slider label="Assinatura mensal (simulação)" value={plan} min={50} max={600} step={10} onChange={setPlan} format={money} />
          </div>
        </div>
        <div className="rounded-[14px] bg-cz-navy p-8 text-[#faf8f5]" aria-live="polite">
          <p className="text-sm uppercase tracking-wider text-[#c5cbd5]">Vendas no mês</p>
          <p className="cz-heading text-3xl font-bold tabular-nums">{money(gmv)}</p>
          <dl className="mt-6 grid gap-3">
            <div className="flex justify-between border-b border-white/10 pb-3">
              <dt>Marketplace ({rate.toLocaleString("pt-BR")}%)</dt>
              <dd className="font-semibold tabular-nums text-[#f0a3a3]">− {money(fee)}</dd>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-3">
              <dt>Assinatura fixa</dt>
              <dd className="font-semibold tabular-nums">− {money(plan)}</dd>
            </div>
          </dl>
          <p className="mt-6 text-sm uppercase tracking-wider text-[#c5cbd5]">Diferença a seu favor</p>
          <p className="cz-heading text-5xl font-bold tabular-nums text-cz-gold">{money(save)}</p>
          <p className="mt-1 text-[#c5cbd5]">por mês · {money(save * 12)} por ano</p>
        </div>
      </div>
    </section>
  );
}

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const id = label.replace(/\W+/g, "-");
  return (
    <div>
      <div className="flex justify-between text-sm font-semibold">
        <label htmlFor={id}>{label}</label>
        <span className="tabular-nums">{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 h-11 w-full accent-[#0b1f40]" />
    </div>
  );
}
