import type {
  Category,
  Coupon,
  IntegrationSettings,
  Order,
  Product,
  TableTab,
  Tenant,
  WhatsappTrigger,
} from "./types";

const img = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

const allWeek = (open: string, close: string) => [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open, close }));

export const TENANTS: Tenant[] = [
  {
    id: "t_cafe",
    slug: "cafe-e-flor",
    name: "Café e Flor",
    tagline: "Um cantinho para a sua pausa · Cafeteria artesanal",
    description:
      "Café passado com carinho, bolos caseiros, croissants quentinhos e aquele aconchego cheio de flores. Dentro do Covabra Centro.",
    category: "Cafeteria artesanal",
    logo: "/tenants/cafe-e-flor/logo.webp",
    cover: img("1509042239860-f550ce710b93", 1600),
    theme: {
      paper: "#FAF6F0",
      surface: "#FFFFFF",
      ink: "#2C1A12",
      muted: "#6B5246",
      primary: "#2C1A12",
      primaryInk: "#FAF6F0",
      secondary: "#5E7153",
      accent: "#C86D51",
      accentText: "#9C4A30",
      highlight: "#D49B4B",
      line: "#EADCCD",
      dark: false,
      fontDisplay: "serif",
    },
    whatsapp: "5519995868521",
    instagram: "cafee_flor",
    address: {
      street: "Av. Presidente Vargas, 375",
      district: "Centro",
      city: "Indaiatuba",
      uf: "SP",
      cep: "13339-125",
      complement: "Dentro do Covabra Supermercados Centro",
    },
    hours: allWeek("07:30", "21:00"),
    prepMinutes: 12,
    rating: 4.9,
    ratingCount: 128,
    modes: ["delivery", "retirada", "mesa", "encomenda"],
    deliveryZones: [
      { id: "z1", bairro: "Centro", fee: 5, minutes: 25 },
      { id: "z2", bairro: "Vila Vitória", fee: 6, minutes: 30 },
      { id: "z3", bairro: "Jardim Pau Preto", fee: 7, minutes: 30 },
      { id: "z4", bairro: "Cidade Nova", fee: 7, minutes: 35 },
      { id: "z5", bairro: "Jardim América", fee: 8, minutes: 35 },
      { id: "z6", bairro: "Itaici", fee: 12, minutes: 45 },
    ],
    deliveryPerKm: 2.5,
    minOrder: 20,
    tables: 12,
    subdomain: "cafeeflor",
    plan: "pro",
    active: true,
    createdAt: "2026-10-03T10:00:00.000Z",
    loyalty: { enabled: true, goal: 10, reward: "1 café ou cappuccino grátis", categoryIds: ["c_cafes"], cashbackPct: 3 },
  },
  {
    id: "t_burger",
    slug: "burger-station",
    name: "Burger Station",
    tagline: "Smash burgers na chapa · Artesanal de verdade",
    description: "Blend próprio, pão brioche selado na manteiga e molhos da casa. Do balcão direto pra sua mesa.",
    category: "Hamburgueria artesanal",
    logo: "/tenants/burger-station/logo.svg",
    cover: img("1541592106381-b31e9677c0e5", 1600),
    theme: {
      paper: "#0E0E10",
      surface: "#18181B",
      ink: "#F4F4F5",
      muted: "#A1A1AA",
      primary: "#FF7A1A",
      primaryInk: "#0E0E10",
      secondary: "#FFB020",
      accent: "#FF7A1A",
      accentText: "#FF8F3D",
      highlight: "#FFB020",
      line: "#2A2A30",
      dark: true,
      fontDisplay: "sans",
    },
    whatsapp: "5519995868521",
    instagram: "burgerstation",
    address: { street: "Rua das Primaveras, 120", district: "Cidade Nova", city: "Indaiatuba", uf: "SP", cep: "13334-100" },
    hours: [
      ...[2, 3, 4, 5, 6].map((day) => ({ day, open: "18:00", close: "23:59" })),
      { day: 0, open: "17:00", close: "23:00" },
    ],
    prepMinutes: 20,
    rating: 4.8,
    ratingCount: 342,
    modes: ["delivery", "retirada", "mesa"],
    deliveryZones: [
      { id: "z1", bairro: "Cidade Nova", fee: 4, minutes: 30 },
      { id: "z2", bairro: "Centro", fee: 6, minutes: 35 },
      { id: "z3", bairro: "Jardim América", fee: 7, minutes: 40 },
    ],
    deliveryPerKm: 2,
    minOrder: 30,
    tables: 16,
    subdomain: "burgerstation",
    plan: "starter",
    active: true,
    createdAt: "2026-10-20T10:00:00.000Z",
    loyalty: { enabled: true, goal: 8, reward: "1 Station Classic grátis", categoryIds: ["b_burgers"], cashbackPct: 0 },
  },
];

export const CATEGORIES: Category[] = [
  { id: "c_cafes", tenantId: "t_cafe", name: "Cafés", icon: "Coffee", order: 1 },
  { id: "c_doces", tenantId: "t_cafe", name: "Bolos & doces", icon: "CakeSlice", order: 2 },
  { id: "c_salgados", tenantId: "t_cafe", name: "Salgados", icon: "Croissant", order: 3 },
  { id: "c_bebidas", tenantId: "t_cafe", name: "Sucos & smoothies", icon: "CupSoda", order: 4 },
  { id: "c_encomendas", tenantId: "t_cafe", name: "Encomendas", icon: "Cake", order: 5 },
  { id: "b_burgers", tenantId: "t_burger", name: "Burgers", icon: "Beef", order: 1 },
  { id: "b_porcoes", tenantId: "t_burger", name: "Porções", icon: "Drumstick", order: 2 },
  { id: "b_bebidas", tenantId: "t_burger", name: "Shakes & bebidas", icon: "CupSoda", order: 3 },
  { id: "b_doces", tenantId: "t_burger", name: "Sobremesas", icon: "IceCreamCone", order: 4 },
];

const p = (x: Omit<Product, "available" | "quickNotes" | "optionGroups"> & Partial<Product>): Product => ({
  available: true,
  quickNotes: [],
  optionGroups: [],
  ...x,
});

export const PRODUCTS: Product[] = [
  p({
    id: "p_espresso_misto",
    tenantId: "t_cafe",
    categoryId: "c_cafes",
    code: "101",
    name: "Espresso & Misto Quente",
    badge: "Combo da pausa",
    description: "Café encorpado acompanhado de misto quente na massa folhada, douradinho na chapa.",
    price: 22.9,
    featured: true,
    image: img("1528735602780-2552fd46c7af"),
    quickNotes: ["Café bem quente", "Sem açúcar", "Pão bem tostado", "Para viagem"],
    optionGroups: [
      {
        id: "g_ponto",
        name: "Ponto do queijo",
        min: 1,
        max: 1,
        choices: [
          { id: "derretido", name: "Derretido", price: 0 },
          { id: "gratinado", name: "Bem gratinado", price: 0 },
        ],
      },
      {
        id: "g_cafe",
        name: "Tipo de café",
        min: 1,
        max: 1,
        choices: [
          { id: "curto", name: "Espresso curto", price: 0 },
          { id: "longo", name: "Espresso longo", price: 0 },
          { id: "coado", name: "Café coado", price: 0 },
          { id: "cappu", name: "Trocar por cappuccino", price: 4 },
        ],
      },
      {
        id: "g_add",
        name: "Adicionais",
        min: 0,
        max: 2,
        choices: [
          { id: "requeijao", name: "Requeijão cremoso", price: 3 },
          { id: "ovo", name: "Ovo na chapa", price: 3.5 },
        ],
      },
    ],
  }),
  p({
    id: "p_cappuccino",
    tenantId: "t_cafe",
    categoryId: "c_cafes",
    code: "102",
    name: "Cappuccino Artesanal",
    badge: "Favorito da casa",
    description: "Espresso, leite vaporizado e espuma cremosa, finalizado com canela ou calda de caramelo.",
    price: 15.9,
    featured: true,
    image: img("1572442388796-11668a67e53d"),
    quickNotes: ["Café bem quente", "Pouca espuma", "Para viagem"],
    optionGroups: [
      {
        id: "g_sabor",
        name: "Finalização",
        min: 1,
        max: 1,
        choices: [
          { id: "canela", name: "Canela", price: 0 },
          { id: "caramelo", name: "Caramelo", price: 0 },
        ],
      },
      {
        id: "g_leite",
        name: "Leite",
        min: 1,
        max: 1,
        choices: [
          { id: "integral", name: "Integral", price: 0 },
          { id: "zero", name: "Sem lactose", price: 1.5 },
          { id: "aveia", name: "Vegetal de aveia", price: 2.5 },
        ],
      },
    ],
  }),
  p({
    id: "p_espresso",
    tenantId: "t_cafe",
    categoryId: "c_cafes",
    code: "103",
    name: "Espresso Tradicional",
    description: "Dose única extraída na hora, encorpado e com crema aveludada.",
    price: 6.5,
    image: img("1514432324607-a09d9b4aefdd"),
    quickNotes: ["Café bem quente", "Duplo", "Com leite à parte"],
  }),
  p({
    id: "p_bolo_choc",
    tenantId: "t_cafe",
    categoryId: "c_doces",
    code: "201",
    name: "Bolo de Chocolate Clássico",
    badge: "Fatia",
    description: "Massa fofinha com calda generosa de chocolate e granulado. Impossível comer uma fatia só.",
    price: 14.9,
    featured: true,
    image: img("1578985545062-69928b1d9587"),
    quickNotes: ["Esquentar a fatia", "Para viagem"],
    optionGroups: [
      {
        id: "g_add",
        name: "Adicionais",
        min: 0,
        max: 2,
        choices: [
          { id: "calda", name: "Calda extra quente", price: 3 },
          { id: "sorvete", name: "Sorvete de creme", price: 6 },
        ],
      },
    ],
  }),
  p({
    id: "p_bolo_banana",
    tenantId: "t_cafe",
    categoryId: "c_doces",
    code: "202",
    name: "Bolo de Banana Caramelizada",
    badge: "Caseiro",
    description: "Banana com calda de caramelo sobre massa com canela. Sabor de café da tarde de vó.",
    price: 13.9,
    image: img("1605286978633-2dec93ff88a2"),
    quickNotes: ["Esquentar a fatia", "Para viagem"],
  }),
  p({
    id: "p_cinnamon",
    tenantId: "t_cafe",
    categoryId: "c_doces",
    code: "203",
    name: "Cinnamon Roll Quentinho",
    description: "Massa macia enrolada com canela e açúcar mascavo, coberta com glacê de cream cheese.",
    price: 16.9,
    image: img("1509365465985-25d11c17e812"),
    quickNotes: ["Esquentar", "Cobertura à parte", "Para viagem"],
    optionGroups: [
      {
        id: "g_add",
        name: "Adicionais",
        min: 0,
        max: 1,
        choices: [{ id: "cream", name: "Cream cheese extra", price: 2.5 }],
      },
    ],
  }),
  p({
    id: "p_brownie",
    tenantId: "t_cafe",
    categoryId: "c_doces",
    code: "204",
    name: "Brownie da Casa",
    description: "Chocolate meio amargo, casquinha crocante e miolo úmido.",
    price: 11.9,
    image: img("1606313564200-e75d5e30476c"),
    quickNotes: ["Esquentar", "Para viagem"],
  }),
  p({
    id: "p_croissant",
    tenantId: "t_cafe",
    categoryId: "c_salgados",
    code: "301",
    name: "Croissants Artesanais",
    badge: "Folhados",
    description: "Camadas crocantes e amanteigadas com gergelim. Escolha o recheio.",
    price: 16.5,
    featured: true,
    image: img("1555507036-ab1f4038808a"),
    quickNotes: ["Esquentar", "Para viagem"],
    optionGroups: [
      {
        id: "g_sabor",
        name: "Sabor",
        min: 1,
        max: 1,
        choices: [
          { id: "pq", name: "Presunto e queijo", price: 0 },
          { id: "4q", name: "Quatro queijos", price: 2 },
          { id: "peru", name: "Peito de peru com cream cheese", price: 3 },
          { id: "choc", name: "Chocolate belga", price: 2.5 },
        ],
      },
    ],
  }),
  p({
    id: "p_suco",
    tenantId: "t_cafe",
    categoryId: "c_bebidas",
    code: "401",
    name: "Sucos Naturais & Smoothies",
    badge: "400 ml",
    description: "Feitos na hora com fruta de verdade. Refrescância para acompanhar seu lanche.",
    price: 12,
    image: img("1600271886742-f049cd451bba"),
    quickNotes: ["Bem gelado", "Para viagem"],
    optionGroups: [
      {
        id: "g_sabor",
        name: "Sabor",
        min: 1,
        max: 1,
        choices: [
          { id: "laranja", name: "Laranja", price: 0 },
          { id: "limao", name: "Limão", price: 0 },
          { id: "maracuja", name: "Maracujá", price: 0 },
          { id: "smoothie", name: "Smoothie de manga", price: 4.9 },
        ],
      },
      {
        id: "g_doce",
        name: "Adoçar",
        min: 1,
        max: 1,
        choices: [
          { id: "acucar", name: "Com açúcar", price: 0 },
          { id: "sem", name: "Sem açúcar", price: 0 },
          { id: "adocante", name: "Adoçante", price: 0 },
        ],
      },
      {
        id: "g_gelo",
        name: "Gelo",
        min: 0,
        max: 1,
        choices: [{ id: "gelo", name: "Com gelo", price: 0 }],
      },
    ],
  }),
  p({
    id: "p_bolo_festa",
    tenantId: "t_cafe",
    categoryId: "c_encomendas",
    code: "501",
    name: "Bolos de Festa por Encomenda",
    badge: "Encomenda programada",
    description: "Chantilly, frutas frescas e recheios cremosos. Escolha peso, massa, recheio, data de retirada e a frase do topo.",
    price: 89.9,
    priceLabel: "A partir de R$ 89,90/kg",
    featured: true,
    image: img("1565958011703-44f9829ba187"),
    cake: {
      minKg: 1.5,
      maxKg: 6,
      pricePerKg: 89.9,
      massas: ["Branca de baunilha", "Chocolate", "Red velvet", "Pão de ló de laranja"],
      recheios: ["Morango com chantilly", "Brigadeiro", "Ninho com morango", "Doce de leite com ameixa", "Prestígio"],
      coberturas: ["Chantilly com morangos", "Chantilly com raspas de chocolate", "Ganache de chocolate"],
      leadHours: 48,
      depositPct: 50,
    },
  }),
  p({
    id: "p_salgados",
    tenantId: "t_cafe",
    categoryId: "c_encomendas",
    code: "502",
    name: "Cento de Mini Salgados",
    badge: "Encomenda",
    description: "100 unidades fritas na hora da retirada. Escolha até 3 sabores.",
    price: 89,
    image: img("1601050690597-df0568f70950"),
    preorder: { leadHours: 24, depositPct: 50 },
    optionGroups: [
      {
        id: "g_sabores",
        name: "Sabores (até 3)",
        min: 1,
        max: 3,
        choices: [
          { id: "coxinha", name: "Coxinha de frango", price: 0 },
          { id: "queijo", name: "Bolinha de queijo", price: 0 },
          { id: "risole", name: "Risole de presunto", price: 0 },
          { id: "kibe", name: "Kibe", price: 0 },
          { id: "empada", name: "Empadinha de frango", price: 8 },
        ],
      },
    ],
  }),
  // Burger Station
  p({
    id: "b_classic",
    tenantId: "t_burger",
    categoryId: "b_burgers",
    code: "11",
    name: "Station Classic",
    badge: "Mais pedido",
    description: "Blend 160 g, cheddar inglês, alface, tomate, picles e molho da casa no brioche.",
    price: 32.9,
    featured: true,
    image: img("1568901346375-23c9450c58cd"),
    quickNotes: ["Sem cebola", "Sem picles", "Molho à parte", "Bem passado"],
    optionGroups: [
      {
        id: "g_ponto",
        name: "Ponto da carne",
        min: 1,
        max: 1,
        choices: [
          { id: "mal", name: "Mal passado", price: 0 },
          { id: "ponto", name: "Ao ponto", price: 0 },
          { id: "bem", name: "Bem passado", price: 0 },
        ],
      },
      {
        id: "g_add",
        name: "Adicionais",
        min: 0,
        max: 4,
        choices: [
          { id: "bacon", name: "Bacon crocante", price: 5 },
          { id: "cheddar", name: "Cheddar extra", price: 4 },
          { id: "ovo", name: "Ovo", price: 3 },
          { id: "cebola", name: "Cebola caramelizada", price: 3.5 },
        ],
      },
    ],
  }),
  p({
    id: "b_smash",
    tenantId: "t_burger",
    categoryId: "b_burgers",
    code: "12",
    name: "Double Smash",
    description: "Dois smash de 90 g, queijo prato derretido, cebola na chapa e maionese defumada.",
    price: 38.9,
    featured: true,
    image: img("1550547660-d9450f859349"),
    quickNotes: ["Sem cebola", "Molho à parte"],
    optionGroups: [
      {
        id: "g_add",
        name: "Adicionais",
        min: 0,
        max: 3,
        choices: [
          { id: "bacon", name: "Bacon crocante", price: 5 },
          { id: "smash", name: "Mais um smash", price: 9 },
        ],
      },
    ],
  }),
  p({
    id: "b_bacon",
    tenantId: "t_burger",
    categoryId: "b_burgers",
    code: "13",
    name: "Bacon Lover",
    description: "Blend 180 g, muito bacon, cheddar cremoso e barbecue artesanal.",
    price: 36.9,
    image: img("1594212699903-ec8a3eca50f5"),
    quickNotes: ["Sem cebola", "Bem passado", "Molho à parte"],
  }),
  p({
    id: "b_rustica",
    tenantId: "t_burger",
    categoryId: "b_porcoes",
    code: "21",
    name: "Batata Rústica",
    description: "Batatas com casca, alecrim e páprica. Acompanha maionese verde.",
    price: 19.9,
    image: img("1630384060421-cb20d0e0649d"),
  }),
  p({
    id: "b_cheddar",
    tenantId: "t_burger",
    categoryId: "b_porcoes",
    code: "22",
    name: "Fritas Cheddar & Bacon",
    description: "Fritas crocantes cobertas com cheddar cremoso e bacon em cubos.",
    price: 26.9,
    image: img("1573080496219-bb080dd4f877"),
  }),
  p({
    id: "b_shake",
    tenantId: "t_burger",
    categoryId: "b_bebidas",
    code: "31",
    name: "Milkshake 500 ml",
    description: "Sorvete artesanal batido na hora.",
    price: 21.9,
    image: img("1619158401201-8fa932695178"),
    optionGroups: [
      {
        id: "g_sabor",
        name: "Sabor",
        min: 1,
        max: 1,
        choices: [
          { id: "oreo", name: "Cookies & cream", price: 0 },
          { id: "choc", name: "Chocolate", price: 0 },
          { id: "morango", name: "Morango", price: 0 },
        ],
      },
    ],
  }),
  p({
    id: "b_brownie",
    tenantId: "t_burger",
    categoryId: "b_doces",
    code: "41",
    name: "Brownie com Sorvete",
    description: "Brownie quente, sorvete de creme e calda de chocolate.",
    price: 18.9,
    image: img("1606313564200-e75d5e30476c"),
  }),
];

export const COUPONS: Coupon[] = [
  { id: "cp1", tenantId: "t_cafe", code: "PAUSA10", type: "percent", value: 10, minOrder: 30, active: true, uses: 14 },
  { id: "cp2", tenantId: "t_cafe", code: "FRETEGRATIS", type: "frete", value: 0, minOrder: 50, active: true, uses: 6 },
  { id: "cp3", tenantId: "t_burger", code: "SMASH5", type: "fixed", value: 5, minOrder: 40, active: true, uses: 31 },
];

export const DEFAULT_TEMPLATES: Record<WhatsappTrigger, string> = {
  recebido:
    "Olá, {cliente}! 🌸 Recebemos seu pedido #{numero} na {loja}. Total: {total}. Acompanhe aqui: {link}",
  preparo: "☕ {cliente}, seu pedido #{numero} já está sendo preparado com carinho.",
  pronto: "✅ Pedido #{numero} pronto! Pode retirar no balcão da {loja}.",
  saiu: "🛵 Seu pedido #{numero} saiu para entrega. Chega em instantes!",
  pos_venda: "Como foi sua experiência com a {loja}, {cliente}? Responda de 1 a 5. Sua opinião faz a gente melhorar 💛",
};

export const defaultIntegrations = (tenantId: string): IntegrationSettings => ({
  tenantId,
  whatsapp: {
    provider: "whaileys",
    enabled: true,
    evolution: { baseUrl: "", instance: "", apiKeyRef: "EVOLUTION_API_KEY" },
    triggers: {
      recebido: { enabled: true, template: DEFAULT_TEMPLATES.recebido },
      preparo: { enabled: true, template: DEFAULT_TEMPLATES.preparo },
      pronto: { enabled: true, template: DEFAULT_TEMPLATES.pronto },
      saiu: { enabled: true, template: DEFAULT_TEMPLATES.saiu },
      pos_venda: { enabled: false, template: DEFAULT_TEMPLATES.pos_venda },
    },
  },
  payments: {
    pixGateway: "asaas",
    cardGateway: "infinitepay",
    gateways: {
      infinitepay: { enabled: true, mode: "sandbox", keyRef: "INFINITEPAY_HANDLE", split: false },
      asaas: { enabled: true, mode: "sandbox", keyRef: "ASAAS_API_KEY", split: false },
      mercadopago: { enabled: false, mode: "sandbox", keyRef: "MERCADOPAGO_ACCESS_TOKEN", split: false },
      pagbank: { enabled: false, mode: "sandbox", keyRef: "PAGBANK_TOKEN", split: false },
      stone: { enabled: false, mode: "sandbox", keyRef: "PAGARME_SECRET_KEY", split: false },
      presencial: { enabled: true, mode: "producao", keyRef: "", split: false },
    },
    acceptVR: ["Alelo", "Sodexo / Pluxee", "VR", "Ticket"],
  },
  email: { enabled: false, fromName: "", subdomain: "", verified: false, ownerEmail: "" },
});

export const defaultTables = (tenant: Tenant): TableTab[] =>
  Array.from({ length: tenant.tables }, (_, i) => ({
    tenantId: tenant.id,
    number: String(i + 1).padStart(2, "0"),
    state: "livre",
    items: [],
    people: 0,
  }));

// Histórico de vendas fictício para o dashboard ter o que mostrar no primeiro acesso.
export function demoOrders(now = Date.now()): Order[] {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const names = ["Mariana", "Rafael", "Beatriz", "João", "Camila", "Lucas", "Ana Paula", "Felipe", "Juliana", "Thiago"];
  const channels: Order["channel"][] = ["mesa", "balcao", "delivery", "whatsapp", "loja"];
  const orders: Order[] = [];
  for (const tenant of TENANTS) {
    const products = PRODUCTS.filter((x) => x.tenantId === tenant.id && !x.cake && !x.preorder);
    for (let i = 0; i < 46; i++) {
      const day = Math.floor(rand() * 7);
      const created = new Date(now - day * 86400000 - Math.floor(rand() * 9 * 3600000) - 600000);
      const items = Array.from({ length: 1 + Math.floor(rand() * 3) }, (_, k) => {
        const prod = products[Math.floor(rand() * products.length)];
        return {
          key: `${prod.id}-${k}`,
          productId: prod.id,
          name: prod.name,
          image: prod.image,
          unitPrice: prod.price,
          qty: 1 + Math.floor(rand() * 2),
          options: [],
          notes: "",
        };
      });
      const subtotal = Math.round(items.reduce((s, it) => s + it.unitPrice * it.qty, 0) * 100) / 100;
      const channel = channels[Math.floor(rand() * channels.length)];
      const deliveryFee = channel === "delivery" ? 6 : 0;
      const method = (["pix", "cartao_credito", "cartao_debito", "dinheiro"] as const)[Math.floor(rand() * 4)];
      const at = created.toISOString();
      orders.push({
        id: `hist-${tenant.slug}-${i}`,
        number: 1000 + i,
        tenantId: tenant.id,
        channel,
        mode: channel === "delivery" ? "delivery" : channel === "mesa" ? "mesa" : channel === "balcao" ? "balcao" : "retirada",
        status: "entregue",
        paymentStatus: "pago",
        payments: [{ method, amount: subtotal + deliveryFee }],
        paymentMethod: method,
        gateway: method === "pix" ? "asaas" : "presencial",
        items,
        subtotal,
        deliveryFee,
        discount: 0,
        total: subtotal + deliveryFee,
        customer: { name: names[Math.floor(rand() * names.length)], phone: `55199${String(10000000 + Math.floor(rand() * 89999999))}` },
        createdAt: at,
        updatedAt: at,
        history: [
          { status: "recebido", at },
          { status: "entregue", at },
        ],
        seen: true,
      });
    }
  }
  return orders;
}

export const SEED_SLUGS = TENANTS.map((t) => t.slug);
export const findSeedTenant = (slug: string) => TENANTS.find((t) => t.slug === slug);
