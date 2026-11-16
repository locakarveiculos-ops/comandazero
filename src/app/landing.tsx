"use client";

import * as Tabs from "@radix-ui/react-tabs";
import {
  Accessibility,
  ArrowRight,
  CakeSlice,
  Check,
  Coffee,
  Croissant,
  GraduationCap,
  IceCreamCone,
  Menu as MenuIcon,
  MessageCircle,
  PlayCircle,
  Sandwich,
  ShieldCheck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo, SaasSurface, ThemeToggle, useSaasTheme } from "@/components/brand-switcher";
import { saasBrand } from "@/config/saas-brand";
import { FOUNDER_PRICE, PLANS, TRIAL_DAYS, planById, type Cycle } from "@/lib/plans";
import { cn, money } from "@/lib/utils";

// Prints reais do sistema (gerados por npm run training:capture). Nada de tela inventada.
const SHOT = (p: string) => `/training/screenshots/1.0.0/${p}.webp`;
const SIGNUP = "/entrar?modo=cadastro";
const SALES_WA = process.env.NEXT_PUBLIC_SALES_WHATSAPP?.replace(/\D/g, "");

const NAV = [
  ["#como-funciona", "Como funciona"],
  ["#perfis", "Para a equipe"],
  ["#economia", "Economia"],
  ["#planos", "Planos"],
  ["#perguntas", "Dúvidas"],
] as const;

const SHOWCASE = [
  { id: "painel", label: "Painel", shot: "painel/dashboard-desktop", alt: "Painel do lojista com faturamento do dia, pedidos por canal e produtos mais vendidos" },
  { id: "kds", label: "Cozinha", shot: "kds/fila-desktop", alt: "Tela da cozinha (KDS) com a fila de pedidos e o tempo de cada um" },
  { id: "pdv", label: "Balcão", shot: "pdv/venda", alt: "PDV de balcão com grade de produtos e carrinho da venda" },
  { id: "mesas", label: "Mesas", shot: "mesas/mapa", alt: "Mapa de mesas com ocupação e comandas abertas" },
];

const SEGMENTS = [
  { icon: Coffee, name: "Cafeterias" },
  { icon: Croissant, name: "Padarias" },
  { icon: CakeSlice, name: "Confeitarias" },
  { icon: Sandwich, name: "Lanchonetes e hamburguerias" },
  { icon: IceCreamCone, name: "Açaí e sorveterias" },
  { icon: UtensilsCrossed, name: "Restaurantes de balcão" },
];

const JOURNEY = [
  { title: "O cliente escolhe", text: "Abre o cardápio pelo link ou pelo QR da mesa, sem baixar nada da loja de apps.", shot: "loja/cardapio-desktop", alt: "Cardápio digital da loja de demonstração Café e Flor" },
  { title: "Confirma o pedido", text: "Retirada, mesa, entrega ou encomenda com data. O preço é conferido no servidor.", shot: "loja/checkout", alt: "Tela de finalizar pedido com forma de entrega e pagamento" },
  { title: "A loja recebe na hora", text: "O pedido aparece no painel com som, em qualquer aparelho logado.", shot: "pedidos/novo", alt: "Painel de pedidos destacando um pedido novo" },
  { title: "A cozinha prepara", text: "A fila do KDS mostra o tempo de cada pedido em cores.", shot: "kds/com-pedido", alt: "KDS com um pedido em preparo" },
  { title: "O cliente acompanha", text: "Link de acompanhamento atualiza sozinho: recebido, na cozinha, pronto.", shot: "loja/acompanhamento", alt: "Página de acompanhamento do pedido com as etapas" },
];

const PROFILES = [
  { id: "dono", label: "Dono", title: "Visão do negócio sem planilha", points: ["Faturamento do dia e da semana", "Produtos campeões e pedidos por canal", "Equipe com acesso por papel", "Cardápio, cores e preços em minutos"], shot: "painel/dashboard-desktop", alt: "Dashboard do dono da loja" },
  { id: "caixa", label: "Caixa", title: "Balcão rápido no horário de pico", points: ["Busca por nome ou código e Enter", "Divisão de conta e pagamento misto", "Troco calculado na hora", "Cupom para impressora térmica"], shot: "pdv/pagamento", alt: "PDV na etapa de pagamento" },
  { id: "cozinha", label: "Cozinha", title: "Fila clara, sem papel perdido", points: ["Tela cheia para monitor ou tablet", "Cores por tempo de espera", "Começar, pronto e entregue com um toque", "Observações do cliente em destaque"], shot: "kds/preparando", alt: "KDS com pedidos em preparo" },
  { id: "garcom", label: "Garçom", title: "Mesas e comandas no celular", points: ["Mapa de mesas livres e ocupadas", "Comanda aberta por mesa", "QR Code próprio para cada mesa", "Serviço de 10% opcional"], shot: "mesas/comanda", alt: "Comanda de mesa aberta" },
  { id: "cliente", label: "Cliente", title: "Pedido sem fila e sem cadastro chato", points: ["Cardápio com fotos e complementos", "Instala como app com a marca da loja", "Acompanha o pedido pelo link", "Pede de novo em dois toques"], shot: "loja/produto-modal", alt: "Produto aberto com opções no cardápio do cliente" },
];

const FAQ = [
  ["Preciso de cartão de crédito para testar?", `Não. São ${TRIAL_DAYS} dias grátis com todos os recursos do plano Profissional. No fim do teste você escolhe o plano ou a loja sai do ar, sem cobrança automática.`],
  ["A ComandaZero cobra comissão por pedido?", "Não. Você paga só a mensalidade do plano. Se usar um meio de pagamento online, a taxa é a do contrato com o gateway (Mercado Pago, Asaas, PagBank e outros), não nossa."],
  ["Funciona em celular, tablet e computador?", "Sim, tudo roda no navegador. O cardápio pode ser instalado no celular do cliente como um app com o nome e o ícone da sua loja, e o KDS funciona em qualquer TV ou monitor com navegador."],
  ["Como o cliente paga?", "No balcão, na mesa ou na entrega: Pix, cartão ou dinheiro, com troco calculado. O pagamento online com Pix e confirmação automática é ativado quando a loja conecta um gateway."],
  ["Posso usar o número de WhatsApp da minha loja?", "Sim. No plano Profissional você conecta o WhatsApp da loja pelo QR Code no painel, e o sistema avisa o cliente a cada etapa do pedido."],
  ["Preciso de impressora?", "Não. Se quiser, o sistema imprime o cupom em impressora térmica de 58 ou 80 mm pelo próprio navegador."],
  ["Posso cancelar quando quiser?", "Sim, sem multa e sem fidelidade. Seus pedidos e clientes podem ser exportados a qualquer momento."],
  ["Meus dados e os dos meus clientes estão seguros?", "Cada loja só enxerga os próprios dados, a equipe entra com papéis diferentes (dono, gerente, caixa, cozinha, garçom) e seguimos a LGPD. Os detalhes estão na Política de Privacidade."],
];

export function Landing() {
  const dark = useSaasTheme() === "dark";
  const hidden = useSmartHeader();
  const [menu, setMenu] = useState(false);

  return (
    <SaasSurface className="overflow-x-clip">
      {/* Cabeçalho inteligente: some ao rolar para baixo, volta ao rolar para cima. */}
      <header className={cn("fixed inset-x-0 top-0 z-40 border-b border-cz-border bg-cz-bg/95 backdrop-blur motion-safe:transition-transform motion-safe:duration-300", hidden && !menu && "-translate-y-full")}>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/" aria-label={`${saasBrand.name}, início`} className="inline-flex min-h-11 shrink-0 items-center">
            <BrandLogo variant="compact" height={32} onDark={dark} />
          </Link>
          <nav aria-label="Principal" className="ml-auto hidden items-center gap-1 text-sm font-medium lg:flex">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} className="inline-flex min-h-11 items-center rounded-[10px] px-3 hover:bg-cz-surface-2">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <ThemeToggle />
            <Link href="/entrar" className="hidden min-h-11 items-center rounded-[10px] px-3 text-sm font-semibold hover:bg-cz-surface-2 sm:inline-flex">
              Entrar
            </Link>
            <Link href={SIGNUP} className="hidden min-h-11 items-center rounded-[10px] bg-brand px-4 text-sm font-semibold text-brand-ink hover:opacity-90 sm:inline-flex">
              Testar grátis
            </Link>
            <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-controls="menu-mobile" aria-label={menu ? "Fechar menu" : "Abrir menu"} className="grid size-11 place-items-center rounded-[10px] hover:bg-cz-surface-2 lg:hidden">
              {menu ? <X className="size-5" aria-hidden /> : <MenuIcon className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
        {menu && (
          <nav id="menu-mobile" aria-label="Menu" className="border-t border-cz-border px-4 pb-4 lg:hidden">
            <ul className="grid gap-1 pt-2">
              {NAV.map(([href, label]) => (
                <li key={href}>
                  <a href={href} onClick={() => setMenu(false)} className="flex min-h-11 items-center rounded-[10px] px-3 font-semibold hover:bg-cz-surface-2">
                    {label}
                  </a>
                </li>
              ))}
              <li className="grid grid-cols-2 gap-2 pt-2">
                <Link href="/entrar" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-cz-border font-semibold">
                  Entrar
                </Link>
                <Link href={SIGNUP} className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-brand font-semibold text-brand-ink">
                  Testar grátis
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main id="conteudo" className="pt-[68px]">
        <Hero />
        <VideoTour />
        <Segments />
        <Journey />
        <Profiles />
        <WhatsappSection />
        <TrainingSection />
        <Savings />
        <Plans />
        <Faq />
      </main>

      <Footer />

      {SALES_WA && (
        <a
          href={`https://wa.me/${SALES_WA}?text=${encodeURIComponent("Olá! Quero conhecer a ComandaZero para a minha loja.")}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar com a equipe de vendas no WhatsApp"
          className="fixed bottom-4 right-4 z-40 grid size-14 place-items-center rounded-full bg-[#128c4a] text-white shadow-xl hover:brightness-110"
        >
          <MessageCircle className="size-7" aria-hidden />
        </a>
      )}
    </SaasSurface>
  );
}

/** Esconde o cabeçalho ao rolar para baixo (depois de 120 px) e mostra ao rolar para cima. */
function useSmartHeader() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 120 && y > last);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}

function Shot({ src, alt, priority, sizes = "(min-width: 1024px) 640px, 100vw", className, w = 1440, h = 900 }: { src: string; alt: string; priority?: boolean; sizes?: string; className?: string; w?: number; h?: number }) {
  return <Image src={SHOT(src)} alt={alt} width={w} height={h} sizes={sizes} priority={priority} className={cn("h-auto w-full", className)} />;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold uppercase tracking-[0.14em] text-cz-gold-text">{children}</p>;
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-cz-navy text-[#faf8f5]" aria-labelledby="hero-titulo">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#d4af6b 1px, transparent 1px)", backgroundSize: "22px 22px" }} aria-hidden />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:pb-24 lg:pt-16">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-cz-gold/40 px-3 py-1 text-sm font-semibold text-cz-gold">0% de comissão por pedido</p>
          <h1 id="hero-titulo" className="cz-heading mt-5 text-4xl font-bold leading-[1.08] sm:text-5xl">
            Seu cardápio, seu balcão e sua cozinha <span className="text-cz-gold">no mesmo sistema.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[#c5cbd5]">
            Para cafeterias, padarias, confeitarias e lanchonetes. O cliente pede pelo app com a marca da sua loja, o pedido cai no balcão e na cozinha na hora, e o WhatsApp avisa cada etapa.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={SIGNUP} className="inline-flex min-h-12 items-center gap-2 rounded-[10px] bg-cz-gold px-6 font-semibold text-cz-navy hover:brightness-105">
              Testar {TRIAL_DAYS} dias grátis <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/loja/cafe-e-flor" className="inline-flex min-h-12 items-center gap-2 rounded-[10px] border border-white/30 px-6 font-semibold text-white hover:bg-white/10">
              <PlayCircle className="size-4" aria-hidden /> Ver loja demo: Café e Flor
            </Link>
          </div>
          <a href="#video" className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-cz-gold underline-offset-4 hover:underline">
            <PlayCircle className="size-5" aria-hidden /> Assistir em 1 minuto
          </a>
          <p className="mt-2 text-sm text-[#c5cbd5]">
            Sem cartão de crédito. Outra demonstração:{" "}
            <Link href="/loja/burger-station" className="inline-flex min-h-11 items-center font-semibold text-[#e8dcc8] underline underline-offset-4">
              Burger Station
            </Link>{" "}
            ·{" "}
            <Link href="/painel/cafe-e-flor" className="inline-flex min-h-11 items-center font-semibold text-[#e8dcc8] underline underline-offset-4">
              painel do lojista
            </Link>
          </p>
        </div>
        <Showcase />
      </div>
    </section>
  );
}

/** Vitrine interativa: abas trocam o print real exibido na janela; celular mostra o cardápio do cliente. */
function Showcase() {
  return (
    <Tabs.Root defaultValue="painel" className="relative min-w-0 pb-10 sm:pb-14">
      <Tabs.List aria-label="Telas do sistema" className="mb-3 flex flex-wrap gap-2">
        {SHOWCASE.map((s) => (
          <Tabs.Trigger
            key={s.id}
            value={s.id}
            className="min-h-11 rounded-full px-4 text-sm font-semibold text-white/85 ring-1 ring-white/25 data-[state=active]:bg-cz-gold data-[state=active]:text-cz-navy data-[state=active]:ring-cz-gold"
          >
            {s.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <div className="overflow-hidden rounded-[14px] border border-white/15 bg-[#08162d] shadow-2xl">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2" aria-hidden>
          <i className="size-2.5 rounded-full bg-white/25" />
          <i className="size-2.5 rounded-full bg-white/25" />
          <i className="size-2.5 rounded-full bg-white/25" />
          <span className="ml-2 truncate text-xs text-white/60">comandazero.com.br/painel</span>
        </div>
        {SHOWCASE.map((s, i) => (
          <Tabs.Content key={s.id} value={s.id} forceMount className="data-[state=inactive]:hidden" tabIndex={-1}>
            <Shot src={s.shot} alt={s.alt} priority={i === 0} sizes="(min-width: 1024px) 600px, 92vw" />
          </Tabs.Content>
        ))}
      </div>
      <div className="absolute -bottom-0 right-2 w-[28%] min-w-28 max-w-44 overflow-hidden rounded-[22px] border-[6px] border-[#1b3156] bg-white shadow-2xl sm:right-4">
        <Shot src="loja/cardapio-mobile" w={390} h={844} sizes="180px" alt="Cardápio da loja aberto no celular do cliente" />
      </div>
    </Tabs.Root>
  );
}

/**
 * Vídeo da campanha (1 min, telas reais do sistema). Não toca sozinho e só baixa ao clicar (preload="none"),
 * para não pesar a primeira carga da página. Arquivo em public/video (origem: _brandkit, campanha 60 s 1920x1080).
 */
function VideoTour() {
  return (
    <section id="video" className="scroll-mt-20 bg-cz-navy pb-20 text-[#faf8f5]" aria-labelledby="video-titulo">
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-cz-gold">Veja em 1 minuto</p>
          <h2 id="video-titulo" className="cz-heading mt-2 text-3xl font-bold sm:text-4xl">
            Do pedido no celular ao balcão e à cozinha
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[#c5cbd5]">Telas reais do sistema, na loja de demonstração Café e Flor: cardápio, carrinho, painel de pedidos, cozinha e PDV.</p>
        </div>
        <div className="mt-8 overflow-hidden rounded-[18px] border border-white/15 bg-[#08162d] shadow-2xl">
          <video
            controls
            playsInline
            preload="none"
            poster="/video/comandazero-em-1-minuto-capa.webp"
            width={1920}
            height={1080}
            className="aspect-video h-auto w-full"
            aria-label="Vídeo de 1 minuto mostrando o ComandaZero em uma cafeteria"
          >
            <source src="/video/comandazero-em-1-minuto.mp4" type="video/mp4" />
            Seu navegador não reproduz vídeo. <a href="/video/comandazero-em-1-minuto.mp4">Baixe o vídeo</a>.
          </video>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={SIGNUP} className="inline-flex min-h-12 items-center gap-2 rounded-[10px] bg-cz-gold px-6 font-semibold text-cz-navy hover:brightness-105">
            Testar {TRIAL_DAYS} dias grátis <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Segments() {
  return (
    <section className="border-b border-cz-border bg-cz-surface py-10" aria-labelledby="segmentos">
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="segmentos" className="text-center text-sm font-semibold uppercase tracking-[0.14em] text-cz-muted">
          Feito para quem vende no balcão
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SEGMENTS.map((s) => (
            <li key={s.name} className="flex min-h-14 items-center gap-2 rounded-[12px] border border-cz-border px-3 text-sm font-semibold">
              <s.icon className="size-5 shrink-0 text-cz-gold-text" aria-hidden /> {s.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Journey() {
  return (
    <section id="como-funciona" className="scroll-mt-20 py-20" aria-labelledby="jornada">
      <div className="mx-auto max-w-6xl px-4">
        <Eyebrow>Como funciona</Eyebrow>
        <h2 id="jornada" className="cz-heading mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">
          Do toque do cliente ao pedido pronto, em 5 passos
        </h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          {JOURNEY.map((j, i) => (
            <li key={j.title} className="flex flex-col overflow-hidden rounded-[14px] border border-cz-border bg-cz-surface">
              <div className="border-b border-cz-border bg-cz-surface-2">
                <Shot src={j.shot} alt={j.alt} sizes="(min-width: 1024px) 220px, (min-width: 768px) 45vw, 92vw" />
              </div>
              <div className="p-4">
                <span className="cz-heading grid size-9 place-items-center rounded-full border-2 border-cz-gold text-sm font-bold">{i + 1}</span>
                <h3 className="mt-3 font-semibold">{j.title}</h3>
                <p className="mt-1 text-sm text-cz-muted">{j.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Profiles() {
  return (
    <section id="perfis" className="scroll-mt-20 border-y border-cz-border bg-cz-surface py-20" aria-labelledby="perfis-titulo">
      <div className="mx-auto max-w-6xl px-4">
        <Eyebrow>Para cada pessoa da loja</Eyebrow>
        <h2 id="perfis-titulo" className="cz-heading mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">
          Cada um vê só o que precisa
        </h2>
        <Tabs.Root defaultValue="dono" className="mt-8">
          <Tabs.List aria-label="Perfis" className="flex flex-wrap gap-2">
            {PROFILES.map((p) => (
              <Tabs.Trigger
                key={p.id}
                value={p.id}
                className="min-h-11 rounded-full px-5 text-sm font-semibold ring-1 ring-cz-border data-[state=active]:bg-cz-navy data-[state=active]:text-white data-[state=active]:ring-cz-navy"
              >
                {p.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {PROFILES.map((p) => (
            <Tabs.Content key={p.id} value={p.id} className="mt-6 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <h3 className="cz-heading text-2xl font-bold">{p.title}</h3>
                <ul className="mt-4 grid gap-2">
                  {p.points.map((t) => (
                    <li key={t} className="flex gap-2">
                      <Check className="mt-1 size-4 shrink-0 text-cz-success" aria-hidden /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="overflow-hidden rounded-[14px] border border-cz-border shadow-lg">
                <Shot src={p.shot} alt={p.alt} sizes="(min-width: 1024px) 660px, 92vw" />
              </div>
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </div>
    </section>
  );
}

function WhatsappSection() {
  return (
    <section className="py-20" aria-labelledby="whatsapp">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2 lg:items-center">
        <div>
          <Eyebrow>WhatsApp da loja</Eyebrow>
          <h2 id="whatsapp" className="cz-heading mt-2 text-3xl font-bold sm:text-4xl">
            O cliente fica sabendo de tudo, sem você digitar
          </h2>
          <ul className="mt-6 grid gap-3">
            {["Confirmação do pedido com botões de resposta", "Aviso quando entra na cozinha, fica pronto e sai para entrega", "Cardápio em lista dentro da conversa", "Conecta o número da sua loja lendo um QR Code no painel"].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-1 size-4 shrink-0 text-cz-success" aria-hidden /> {t}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-cz-muted">Disponível nos planos Profissional e Rede.</p>
        </div>
        <div className="relative">
          <div className="overflow-hidden rounded-[14px] border border-cz-border shadow-lg">
            <Shot src="integracoes/whatsapp" alt="Tela de integrações com a conexão do WhatsApp da loja" sizes="(min-width: 1024px) 560px, 92vw" />
          </div>
          <div className="absolute -bottom-6 left-3 max-w-[260px] rounded-[14px] rounded-bl-sm bg-[#dcf8c6] p-3 text-sm text-[#1f2c1a] shadow-xl" aria-hidden>
            <p>
              <b>Café e Flor:</b> Seu pedido #1043 está pronto para retirada.
            </p>
            <p className="mt-2 grid grid-cols-2 gap-1 text-center text-xs font-semibold text-[#075e54]">
              <span className="rounded-md bg-white py-1">Estou a caminho</span>
              <span className="rounded-md bg-white py-1">Falar com a loja</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrainingSection() {
  return (
    <section className="border-y border-cz-border bg-cz-surface py-16" aria-labelledby="treinamento">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[auto_1fr_auto] md:items-center">
        <span className="grid size-16 place-items-center rounded-[14px] bg-cz-navy text-cz-gold">
          <GraduationCap className="size-8" aria-hidden />
        </span>
        <div>
          <h2 id="treinamento" className="cz-heading text-2xl font-bold sm:text-3xl">
            Equipe treinada no primeiro dia
          </h2>
          <p className="mt-2 max-w-2xl text-cz-muted">Central de treinamento dentro do painel, com tour guiado em cada tela, artigos com prints reais e progresso por pessoa. Caixa novo aprende o PDV em minutos.</p>
        </div>
        <Link href="/painel/cafe-e-flor/treinamento" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] border border-cz-border px-5 font-semibold hover:bg-cz-surface-2">
          Ver a central <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function Savings() {
  const [sales, setSales] = useState(40_000);
  const [rate, setRate] = useState(23);
  const pro = planById("pro");
  const fee = (sales * rate) / 100;
  const save = Math.max(0, fee - pro.monthly);

  return (
    <section id="economia" className="scroll-mt-20 py-20" aria-labelledby="economia-titulo">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow>Calculadora</Eyebrow>
            <h2 id="economia-titulo" className="cz-heading mt-2 text-3xl font-bold sm:text-4xl">
              Quanto o marketplace leva por mês?
            </h2>
            <p className="mt-2 text-cz-muted">Compare a comissão do app de delivery com a mensalidade fixa do plano {pro.name}. Ajuste à sua realidade.</p>
            <div className="mt-8 grid gap-6">
              <Slider label="Vendas mensais pelo delivery" value={sales} min={10_000} max={150_000} step={1_000} onChange={setSales} format={money} />
              <Slider label="Comissão + taxas do marketplace" value={rate} min={12} max={30} step={0.5} onChange={setRate} format={(v) => `${v.toLocaleString("pt-BR")}%`} />
            </div>
          </div>
          <div className="rounded-[14px] bg-cz-navy p-8 text-[#faf8f5]" aria-live="polite">
            <dl className="grid gap-3">
              <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
                <dt>Marketplace ({rate.toLocaleString("pt-BR")}%)</dt>
                <dd className="font-semibold tabular-nums text-[#f0a3a3]">− {money(fee)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
                <dt>ComandaZero {pro.name}</dt>
                <dd className="font-semibold tabular-nums">− {money(pro.monthly)}</dd>
              </div>
            </dl>
            <p className="mt-6 text-sm uppercase tracking-wider text-[#c5cbd5]">Fica com você</p>
            <p className="cz-heading text-4xl font-bold tabular-nums text-cz-gold sm:text-5xl">{money(save)}</p>
            <p className="mt-1 text-[#c5cbd5]">por mês · {money(save * 12)} por ano</p>
            <p className="mt-4 text-xs text-[#c5cbd5]">Simulação. Taxas de pagamento online, quando usadas, são do gateway e não entram na conta.</p>
          </div>
        </div>

        <div className="mt-12 overflow-x-auto rounded-[14px] border border-cz-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Comparação entre ComandaZero e marketplace de delivery</caption>
            <thead className="bg-cz-surface-2">
              <tr>
                <th scope="col" className="p-4">
                  <span className="sr-only">Item</span>
                </th>
                <th scope="col" className="p-4">ComandaZero</th>
                <th scope="col" className="p-4">Marketplace de delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cz-border">
              {[
                ["Comissão por pedido", "0%", "Em geral de 12% a 27%"],
                ["App com a marca da sua loja", "Sim", "Não, a marca é do marketplace"],
                ["Contato do cliente", "Fica com a loja", "Fica com o marketplace"],
                ["Balcão, mesas e cozinha", "PDV, mesas por QR e KDS inclusos", "Só pedidos do app"],
                ["Custo", `A partir de ${money(PLANS[0].monthly)}/mês`, "Percentual sobre cada venda"],
              ].map(([item, cz, mk]) => (
                <tr key={item}>
                  <th scope="row" className="p-4 font-semibold">
                    {item}
                  </th>
                  <td className="p-4">{cz}</td>
                  <td className="p-4 text-cz-muted">{mk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Plans() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  return (
    <section id="planos" className="scroll-mt-20 border-y border-cz-border bg-cz-surface py-20" aria-labelledby="planos-titulo">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Planos</Eyebrow>
            <h2 id="planos-titulo" className="cz-heading mt-2 text-3xl font-bold sm:text-4xl">
              Preço fixo, sem surpresa
            </h2>
            <p className="mt-2 text-cz-muted">
              {TRIAL_DAYS} dias grátis em qualquer plano. Primeiras lojas pagantes do Profissional travam {money(FOUNDER_PRICE)}/mês como preço de fundador.
            </p>
          </div>
          <div role="radiogroup" aria-label="Ciclo de cobrança" className="inline-flex rounded-full border border-cz-border bg-cz-bg p-1">
            {(["monthly", "yearly"] as const).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)} className={cn("min-h-11 rounded-full px-5 text-sm font-semibold", cycle === c && "bg-cz-navy text-white")}>
                {c === "monthly" ? "Mensal" : "Anual (2 meses grátis)"}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-10 grid gap-5 lg:grid-cols-3">
          {PLANS.map((p) => (
            <li key={p.id} className={cn("relative flex flex-col rounded-[14px] border bg-cz-bg p-6", p.popular ? "border-cz-gold ring-2 ring-cz-gold" : "border-cz-border")}>
              {p.popular && <span className="absolute -top-3 left-6 rounded-full bg-cz-gold px-3 py-0.5 text-xs font-bold text-cz-navy">Mais popular</span>}
              <h3 className="text-xl font-bold">{p.name}</h3>
              <p className="mt-1 text-sm text-cz-muted">{p.tagline}</p>
              <p className="mt-5">
                <span className="cz-heading text-4xl font-bold tabular-nums">{money(cycle === "yearly" ? p.yearlyMonthly : p.monthly)}</span>
                <span className="text-sm font-semibold text-cz-muted">/mês</span>
              </p>
              <p className="text-xs text-cz-muted">{cycle === "yearly" ? `${money(p.yearlyMonthly * 12)} por ano` : "cobrado todo mês"}</p>
              <ul className="mt-5 grid flex-1 content-start gap-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-cz-success" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href={SIGNUP}
                className={cn("mt-6 inline-flex min-h-12 items-center justify-center rounded-[10px] font-semibold", p.popular ? "bg-brand text-brand-ink" : "border border-cz-border hover:bg-cz-surface-2")}
              >
                Começar teste grátis
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="perguntas" className="scroll-mt-20 py-20" aria-labelledby="faq">
      <div className="mx-auto max-w-3xl px-4">
        <Eyebrow>Dúvidas</Eyebrow>
        <h2 id="faq" className="cz-heading mt-2 text-3xl font-bold sm:text-4xl">
          Perguntas frequentes
        </h2>
        <div className="mt-8 divide-y divide-cz-border rounded-[14px] border border-cz-border bg-cz-surface">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <span className="text-xl text-cz-gold-text group-open:rotate-45 motion-safe:transition-transform" aria-hidden>
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-cz-muted">{a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 rounded-[14px] bg-cz-navy p-8 text-center text-[#faf8f5]">
          <h2 className="cz-heading text-2xl font-bold">Sua loja no ar ainda hoje</h2>
          <p className="mt-2 text-[#c5cbd5]">Cadastro em 5 passos, cardápio modelo para começar e {TRIAL_DAYS} dias grátis.</p>
          <Link href={SIGNUP} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-[10px] bg-cz-gold px-6 font-semibold text-cz-navy hover:brightness-105">
            Criar minha loja <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-cz-navy py-12 text-[#c5cbd5]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <BrandLogo variant="slogan" height={40} onDark />
          <p className="mt-4 max-w-sm text-sm">{saasBrand.description}</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#e8dcc8]">
            <Accessibility className="size-4" aria-hidden /> Telas verificadas com testes automáticos WCAG 2.2 AA
          </p>
        </div>
        <nav aria-label="Produto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Produto</h2>
          <ul className="mt-3 grid gap-1 text-sm">
            {[
              ["#planos", "Planos"],
              ["#como-funciona", "Como funciona"],
              ["/loja/cafe-e-flor", "Loja de demonstração"],
              ["/entrar", "Entrar no painel"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center hover:text-white hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Institucional">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Institucional</h2>
          <ul className="mt-3 grid gap-1 text-sm">
            <li>
              <Link href="/termos" className="inline-flex min-h-11 items-center hover:text-white hover:underline">
                Termos de Uso
              </Link>
            </li>
            <li>
              <Link href="/privacidade" className="inline-flex min-h-11 items-center hover:text-white hover:underline">
                Política de Privacidade
              </Link>
            </li>
            <li className="flex min-h-11 items-center gap-2">
              <ShieldCheck className="size-4" aria-hidden /> Dados tratados conforme a LGPD
            </li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap justify-between gap-2 border-t border-white/10 px-4 pt-6 text-xs">
        <p>© {new Date().getFullYear()} {saasBrand.name}. Taxas de gateways de pagamento não fazem parte da assinatura.</p>
      </div>
    </footer>
  );
}

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const id = label.replace(/\W+/g, "-");
  return (
    <div>
      <div className="flex justify-between gap-3 text-sm font-semibold">
        <label htmlFor={id}>{label}</label>
        <span className="tabular-nums">{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 h-11 w-full accent-[#0b1f40]" />
    </div>
  );
}
