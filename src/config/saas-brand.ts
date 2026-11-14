// Fonte única da marca do SaaS (ComandaZero · Navy Gold). Independente das marcas dos estabelecimentos.
// Assets oficiais copiados de _brandkit/ComandaZero_NavyGold_BrandKit para public/brand/comandazero/.

const A = "/brand/comandazero";

export const saasBrand = {
  name: "ComandaZero",
  shortName: "ComandaZero",
  slogan: "Seu negócio no controle.",
  // Promessa comercial: a plataforma não cobra comissão por pedido (taxas de gateway são do gateway).
  marketingClaim: "0% de comissão por pedido",
  description: "Cardápio digital instalável com a marca da sua loja, PDV, KDS, mesas por QR Code, WhatsApp com botões e Pix.",
  palette: {
    navy: "#0B1F40",
    gold: "#D4AF6B",
    warmWhite: "#FAF8F5",
    charcoal: "#2B2B2B",
    softBeige: "#E8DCC8",
    accessibleGoldText: "#8A5C21",
    darkBg: "#08162D",
  },
  assets: {
    logoWithSlogan: `${A}/logo-horizontal-com-slogan.svg`,
    logoHorizontal: `${A}/logo-horizontal.svg`,
    logoDarkBackground: `${A}/logo-horizontal-fundo-escuro.svg`,
    logoVertical: `${A}/logo-vertical.svg`,
    logoVerticalWithSlogan: `${A}/logo-vertical-com-slogan.svg`,
    logoCompact: `${A}/logo-reduzido.svg`,
    logoCompactDark: `${A}/logo-reduzido-fundo-escuro.svg`,
    symbol: `${A}/simbolo-dourado.svg`,
    symbolMonoDark: `${A}/simbolo-monocromatico-escuro.svg`,
    symbolMonoWhite: `${A}/simbolo-monocromatico-branco.svg`,
    logoMonoDark: `${A}/logo-monocromatico-escuro.svg`,
    logoMonoWhite: `${A}/logo-monocromatico-branco.svg`,
    favicon: `${A}/favicon.ico`,
    favicon32: `${A}/icon-32x32.png`,
    appleTouchIcon: `${A}/apple-touch-icon.png`,
    pwa192: `${A}/icon-192x192.png`,
    pwa512: `${A}/icon-512x512.png`,
    pwaMaskable192: `${A}/icon-maskable-192x192.png`,
    pwaMaskable512: `${A}/icon-maskable-512x512.png`,
  },
  // Proporções nativas dos SVGs (largura/altura) para renderizar sem distorcer.
  ratio: {
    horizontal: 1000 / 206,
    compact: 720 / 124,
    vertical: 800 / 317,
    verticalWithSlogan: 800 / 363,
    symbol: 256 / 276,
  },
} as const;

/** Domínio oficial da plataforma (registrado). Subdomínios das lojas: <loja>.comandazero.com.br. */
export const PLATFORM_DOMAIN = "comandazero.com.br";
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || PLATFORM_DOMAIN;
/** URL pública do app (links de e-mail, OAuth, canonical). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://comandazero.vercel.app").replace(/\/+$/, "");
