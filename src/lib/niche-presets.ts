import type { Category, OptionGroup, OrderMode, Product } from "./types";
import { uid } from "./utils";

/**
 * Presets dos 6 nichos: cardápio inicial (categorias, produtos e complementos), modos de atendimento,
 * recursos que já nascem ligados e paletas com contraste AA (validado em tests/niche-presets.test.ts).
 * Usado no onboarding (loja real) e no "Carregar exemplos" do Cardápio (real e demo).
 */
export type NicheId = "cafeteria" | "padaria" | "confeitaria" | "hamburgueria" | "acai_sorveteria" | "restaurante_balcao";

export type NicheFeatures = {
  /** Cartão fidelidade ligado ao criar a loja. */
  loyalty: boolean;
  /** Mesas e comandas (QR por mesa). */
  tables: boolean;
  delivery: boolean;
  /** Número do pedido exibido como senha de chamada na Tela da Cozinha. */
  callNumber: boolean;
};

type Choice = string | [name: string, price: number];
type PresetGroup = { name: string; min: number; max: number; choices: Choice[] };
type PresetProduct = Pick<Product, "name" | "description" | "price" | "image"> &
  Partial<Pick<Product, "badge" | "featured" | "quickNotes" | "cake" | "preorder" | "priceLabel">> & { cat: number; groups?: PresetGroup[] };

export type NichePreset = {
  id: NicheId;
  label: string;
  /** Frase curta do card do onboarding. */
  pitch: string;
  /** O que o sistema destaca para este nicho (texto do onboarding). */
  highlights: string[];
  modes: OrderMode[];
  features: NicheFeatures;
  palettes: { name: string; primary: string; accent: string }[];
  loyaltyReward: string;
  categories: { name: string; icon: string }[];
  products: PresetProduct[];
};

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=75`;

export const NICHES: NichePreset[] = [
  {
    id: "cafeteria",
    label: "Cafeteria",
    pitch: "Cafés, lanches e doces no balcão ou na mesa",
    highlights: ["Cartão fidelidade já ligado", "Mesas com QR Code e balcão", "Leite, tamanho e temperatura no pedido"],
    modes: ["retirada", "mesa"],
    features: { loyalty: true, tables: true, delivery: false, callNumber: false },
    palettes: [
      { name: "Café", primary: "#2C1A12", accent: "#C86D51" },
      { name: "Verde", primary: "#1F3D2B", accent: "#7FA36B" },
    ],
    loyaltyReward: "1 café grátis",
    categories: [
      { name: "Cafés", icon: "Coffee" },
      { name: "Salgados", icon: "Croissant" },
      { name: "Doces", icon: "CakeSlice" },
    ],
    products: [
      {
        cat: 0, name: "Espresso", description: "Dose extraída na hora, encorpada e com crema aveludada.", price: 6.5, image: img("1514432324607-a09d9b4aefdd"),
        quickNotes: ["Bem quente", "Sem açúcar", "Para viagem"],
        groups: [{ name: "Tamanho", min: 1, max: 1, choices: ["Simples", ["Duplo", 3]] }],
      },
      {
        cat: 0, name: "Cappuccino Artesanal", badge: "Favorito da casa", featured: true,
        description: "Espresso, leite vaporizado e espuma cremosa com canela.", price: 15.9, image: img("1572442388796-11668a67e53d"),
        quickNotes: ["Pouca espuma", "Para viagem"],
        groups: [
          { name: "Tipo de leite", min: 1, max: 1, choices: ["Integral", ["Zero lactose", 1.5], ["Vegetal (aveia)", 2.5]] },
          { name: "Temperatura", min: 1, max: 1, choices: ["Quente", "Morno", ["Gelado", 2]] },
          { name: "Tamanho", min: 1, max: 1, choices: ["Médio (200 ml)", ["Grande (300 ml)", 4]] },
        ],
      },
      { cat: 1, name: "Pão de Queijo", badge: "Quentinho", description: "Porção com 4 unidades, crocante por fora e macio por dentro.", price: 9.9, image: img("1608198093002-ad4e005484ec"), quickNotes: ["Esquentar", "Para viagem"] },
      {
        cat: 1, name: "Croissant", featured: true, description: "Massa folhada amanteigada. Escolha o recheio.", price: 14.5, image: img("1555507036-ab1f4038808a"),
        groups: [{ name: "Recheio", min: 1, max: 1, choices: ["Presunto e queijo", ["Peito de peru", 2], ["Chocolate", 2]] }],
      },
      { cat: 2, name: "Bolo de Chocolate (fatia)", description: "Massa fofinha com calda generosa.", price: 12.9, image: img("1578985545062-69928b1d9587"), quickNotes: ["Esquentar a fatia"] },
    ],
  },
  {
    id: "padaria",
    label: "Padaria",
    pitch: "Pão, café da manhã e salgados com caixa rápido",
    highlights: ["Frente de Caixa (PDV) em grade, venda em segundos", "Venda de balcão sem cadastrar cliente", "Ponto na chapa e pão cortado"],
    modes: ["retirada"],
    features: { loyalty: false, tables: false, delivery: false, callNumber: false },
    palettes: [
      { name: "Trigo", primary: "#5A3410", accent: "#E0A43A" },
      { name: "Marinho", primary: "#0B1F40", accent: "#D4AF6B" },
    ],
    loyaltyReward: "1 café com leite grátis",
    categories: [
      { name: "Pães", icon: "Wheat" },
      { name: "Café da manhã", icon: "Coffee" },
      { name: "Salgados", icon: "Croissant" },
      { name: "Bebidas quentes", icon: "Milk" },
    ],
    products: [
      {
        cat: 0, name: "Pão Francês", badge: "Saindo agora", featured: true, description: "Casquinha crocante. Venda por unidade ou por peso.", price: 1, image: img("1598515214211-89d3c73ae83b"),
        groups: [{ name: "Quantidade", min: 1, max: 1, choices: ["1 unidade", ["Meio quilo (≈ 10 un.)", 8.9], ["1 quilo (≈ 20 un.)", 18.9]] }],
        quickNotes: ["Bem moreno", "Branquinho"],
      },
      {
        cat: 1, name: "Combo Café da Manhã", featured: true, description: "Pão na chapa, café com leite e suco de laranja.", price: 19.9, image: img("1528735602780-2552fd46c7af"),
        groups: [
          { name: "Ponto na chapa", min: 1, max: 1, choices: ["Com manteiga", "Com requeijão", "Na saída (sem chapa)"] },
          { name: "Cortado ao meio?", min: 0, max: 1, choices: ["Sim, cortar ao meio"] },
        ],
      },
      {
        cat: 1, name: "Pão na Chapa", description: "Pão francês tostado na chapa.", price: 6.5, image: img("1528735602780-2552fd46c7af"),
        groups: [{ name: "Ponto na chapa", min: 1, max: 1, choices: ["Com manteiga", ["Com requeijão", 1.5], "Na saída (sem chapa)"] }],
        quickNotes: ["Cortado ao meio", "Bem tostado"],
      },
      { cat: 2, name: "Coxinha de Frango", description: "Massa leve e recheio cremoso.", price: 7.5, image: img("1601050690597-df0568f70950"), quickNotes: ["Esquentar"] },
      {
        cat: 3, name: "Café com Leite", description: "Café coado na hora com leite quente.", price: 6, image: img("1514432324607-a09d9b4aefdd"),
        groups: [{ name: "Tamanho", min: 1, max: 1, choices: ["Copo pequeno", ["Copo grande", 2]] }],
      },
    ],
  },
  {
    id: "confeitaria",
    label: "Confeitaria",
    pitch: "Bolos, tortas e doces finos com encomenda",
    highlights: ["Cardápio vitrine com fotos grandes", "Encomenda com data, hora e frase no bolo", "WhatsApp, retirada e entrega"],
    modes: ["retirada", "delivery", "encomenda"],
    features: { loyalty: false, tables: false, delivery: true, callNumber: false },
    palettes: [
      { name: "Framboesa", primary: "#7A1E48", accent: "#F2A7C3" },
      { name: "Chocolate", primary: "#3B2316", accent: "#E8B4A0" },
    ],
    loyaltyReward: "1 fatia grátis",
    categories: [
      { name: "Bolos no pote", icon: "IceCreamBowl" },
      { name: "Fatias", icon: "CakeSlice" },
      { name: "Tortas inteiras (encomenda)", icon: "Cake" },
      { name: "Doces finos", icon: "Gift" },
    ],
    products: [
      {
        cat: 0, name: "Bolo no Pote Ninho com Morango", featured: true, description: "Camadas de massa, creme de leite Ninho e morangos frescos.", price: 16.9, image: img("1488477181946-6428a0291777"),
        groups: [{ name: "Embalagem", min: 0, max: 1, choices: [["Embalagem para presente", 4]] }],
      },
      { cat: 1, name: "Fatia Supreme", badge: "Assinatura da casa", featured: true, description: "Chocolate belga, ganache e crocante de avelã.", price: 18.9, image: img("1578985545062-69928b1d9587") },
      {
        cat: 2, name: "Torta Inteira por Encomenda", badge: "Encomenda", featured: true,
        description: "Escolha peso, massa, recheio, frase no topo e a data de retirada.", price: 95, priceLabel: "A partir de R$ 95,00/kg", image: img("1565958011703-44f9829ba187"),
        cake: {
          minKg: 1, maxKg: 5, pricePerKg: 95,
          massas: ["Baunilha", "Chocolate", "Red velvet"],
          recheios: ["Ninho com morango", "Brigadeiro", "Doce de leite"],
          coberturas: ["Chantilly", "Ganache", "Pasta americana"],
          leadHours: 48, depositPct: 50,
        },
      },
      {
        cat: 3, name: "Caixa de Doces Finos (12 un.)", description: "Brigadeiros gourmet e bem-casados para presentear.", price: 42, image: img("1551024601-bec78aea704b"),
        preorder: { leadHours: 24, depositPct: 50 },
        groups: [{ name: "Embalagem", min: 0, max: 1, choices: [["Embalagem para presente com laço", 6]] }],
        quickNotes: ["Mensagem no cartão"],
      },
    ],
  },
  {
    id: "hamburgueria",
    label: "Lanchonete e hamburgueria",
    pitch: "Burgers, porções e combos para mesa e delivery",
    highlights: ["Tela da Cozinha (KDS) com remoções em destaque", "Ponto da carne, adicionais pagos e combo", "Mesas, Frente de Caixa e delivery"],
    modes: ["retirada", "mesa", "delivery"],
    features: { loyalty: true, tables: true, delivery: true, callNumber: false },
    palettes: [
      { name: "Carvão", primary: "#1E1E1E", accent: "#F2B33D" },
      { name: "Brasa", primary: "#8A1C14", accent: "#FF7A1A" },
    ],
    loyaltyReward: "1 burger grátis",
    categories: [
      { name: "Burgers", icon: "Beef" },
      { name: "Porções", icon: "Drumstick" },
      { name: "Bebidas", icon: "CupSoda" },
    ],
    products: [
      {
        cat: 0, name: "Smash Burger Duplo", badge: "Mais pedido", featured: true, description: "Dois smash de 90 g, queijo derretido e molho da casa no brioche.", price: 34.9, image: img("1550547660-d9450f859349"),
        quickNotes: ["Molho à parte", "Cortar ao meio"],
        groups: [
          { name: "Ponto da carne", min: 1, max: 1, choices: ["Mal passado", "Ao ponto", "Bem passado"] },
          { name: "Adicionais", min: 0, max: 3, choices: [["Bacon extra", 5], ["Cheddar extra", 4], ["Ovo", 3]] },
          { name: "Retirar ingredientes", min: 0, max: 3, choices: ["Sem cebola", "Sem picles", "Sem tomate"] },
          { name: "Transforme em combo", min: 0, max: 1, choices: [["+ Batata e bebida", 14.9]] },
        ],
      },
      {
        cat: 0, name: "Artesanal Bacon", featured: true, description: "Blend 180 g, muito bacon, cheddar cremoso e barbecue.", price: 38.9, image: img("1568901346375-23c9450c58cd"),
        groups: [
          { name: "Ponto da carne", min: 1, max: 1, choices: ["Mal passado", "Ao ponto", "Bem passado"] },
          { name: "Retirar ingredientes", min: 0, max: 2, choices: ["Sem cebola", "Sem barbecue"] },
          { name: "Transforme em combo", min: 0, max: 1, choices: [["+ Batata e bebida", 14.9]] },
        ],
      },
      {
        cat: 1, name: "Porção de Fritas", description: "Batatas crocantes com sal e páprica.", price: 19.9, image: img("1630384060421-cb20d0e0649d"),
        groups: [{ name: "Cobertura", min: 0, max: 2, choices: [["Cheddar", 5], ["Bacon", 6]] }],
      },
      {
        // Foto genérica, sem marca de refrigerante (QA-22).
        cat: 2, name: "Refrigerante Lata", description: "350 ml bem gelado.", price: 6.5, image: img("1513558161293-cdaf765ed2fd"),
        groups: [{ name: "Sabor", min: 1, max: 1, choices: ["Cola", "Cola zero", "Guaraná", "Laranja"] }],
      },
    ],
  },
  {
    id: "acai_sorveteria",
    label: "Açaí e sorveteria",
    pitch: "Copos, barcas e potes montados por etapas",
    highlights: ["Montagem por etapas com limite claro", "Barra de progresso: “2 de 3 selecionados”", "Balcão e delivery"],
    modes: ["retirada", "delivery"],
    features: { loyalty: true, tables: false, delivery: true, callNumber: false },
    palettes: [
      { name: "Açaí", primary: "#3D1A5B", accent: "#A3D65C" },
      { name: "Uva", primary: "#4C1D95", accent: "#F9A8D4" },
    ],
    loyaltyReward: "1 copo de 300 ml grátis",
    categories: [
      { name: "Açaí", icon: "IceCreamBowl" },
      { name: "Sorvetes", icon: "IceCreamCone" },
      { name: "Milkshakes", icon: "CupSoda" },
    ],
    products: [
      {
        cat: 0, name: "Copo de Açaí 500 ml", badge: "Monte do seu jeito", featured: true, description: "Açaí cremoso com frutas, calda e adicionais à sua escolha.", price: 22.9, image: img("1488477181946-6428a0291777"),
        groups: [
          { name: "Escolha até 3 frutas grátis", min: 0, max: 3, choices: ["Banana", "Morango", "Kiwi", "Manga", "Uva"] },
          { name: "Escolha 1 calda", min: 1, max: 1, choices: ["Leite condensado", "Chocolate", "Morango", "Sem calda"] },
          { name: "Turbine seu açaí", min: 0, max: 4, choices: [["Leite Ninho", 3], ["Nutella", 6], ["Paçoca", 2.5], ["Granola", 2]] },
        ],
      },
      {
        cat: 0, name: "Barca de Açaí (2 pessoas)", featured: true, description: "1 litro de açaí servido na barca, para dividir.", price: 49.9, image: img("1488477181946-6428a0291777"),
        groups: [
          { name: "Escolha até 3 frutas grátis", min: 0, max: 3, choices: ["Banana", "Morango", "Kiwi", "Manga"] },
          { name: "Escolha 1 calda", min: 1, max: 1, choices: ["Leite condensado", "Chocolate", "Morango"] },
          { name: "Turbine seu açaí", min: 0, max: 3, choices: [["Leite Ninho", 4], ["Nutella", 8], ["Paçoca", 3]] },
        ],
      },
      {
        cat: 1, name: "Pote de Sorvete 1 L", description: "Sorvete artesanal para levar.", price: 39.9, image: img("1497034825429-c343d7c6a68f"),
        groups: [{ name: "Escolha até 2 sabores", min: 1, max: 2, choices: ["Creme", "Chocolate", "Morango", "Flocos"] }],
      },
      {
        cat: 2, name: "Milkshake 400 ml", description: "Sorvete batido na hora.", price: 19.9, image: img("1619158401201-8fa932695178"),
        groups: [{ name: "Sabor", min: 1, max: 1, choices: ["Chocolate", "Morango", "Ovomaltine"] }],
      },
    ],
  },
  {
    id: "restaurante_balcao",
    label: "Restaurante de balcão",
    pitch: "Prato do dia e marmitas com senha de chamada",
    highlights: ["Senha de chamada na Tela da Cozinha", "Monte o prato: base, proteína e guarnições", "Frente de Caixa rápida e retirada"],
    modes: ["retirada", "delivery"],
    features: { loyalty: false, tables: false, delivery: true, callNumber: true },
    palettes: [
      { name: "Oliva", primary: "#2F3E1F", accent: "#D9A441" },
      { name: "Grafite", primary: "#263238", accent: "#F28C28" },
    ],
    loyaltyReward: "1 marmita grátis",
    categories: [
      { name: "Pratos do dia", icon: "UtensilsCrossed" },
      { name: "Marmitas", icon: "Salad" },
      { name: "Bebidas", icon: "CupSoda" },
      { name: "Sobremesas", icon: "Cookie" },
    ],
    products: [
      {
        cat: 0, name: "Prato Executivo do Dia", badge: "Prato do dia", featured: true, description: "Monte seu prato: base, proteína e duas guarnições.", price: 29.9, image: img("1546069901-ba9599a7e63c"),
        quickNotes: ["Sem salada", "Pouco sal", "Para viagem"],
        groups: [
          { name: "Escolha a base", min: 1, max: 1, choices: ["Arroz branco", "Arroz integral"] },
          { name: "Escolha a proteína", min: 1, max: 1, choices: ["Frango grelhado", "Bife acebolado", ["Filé de peixe", 4]] },
          { name: "Escolha até 2 guarnições", min: 1, max: 2, choices: ["Feijão", "Farofa", "Legumes", "Batata frita", "Salada"] },
        ],
      },
      {
        cat: 1, name: "Marmita Fitness", featured: true, description: "Arroz integral, frango grelhado e legumes no vapor.", price: 27.9, image: img("1512621776951-a57141f2eefd"),
        groups: [
          { name: "Escolha a proteína", min: 1, max: 1, choices: ["Frango grelhado", ["Tilápia", 4]] },
          { name: "Tamanho", min: 1, max: 1, choices: ["Média (400 g)", ["Grande (600 g)", 6]] },
        ],
      },
      {
        cat: 2, name: "Suco Natural 400 ml", description: "Feito na hora com fruta de verdade.", price: 9, image: img("1600271886742-f049cd451bba"),
        groups: [{ name: "Sabor", min: 1, max: 1, choices: ["Laranja", "Limão", "Maracujá"] }],
      },
      { cat: 3, name: "Pudim de Leite", description: "Fatia de pudim com calda de caramelo.", price: 8.5, image: img("1551024601-bec78aea704b") },
    ],
  },
];

export const nicheById = (id: string) => NICHES.find((n) => n.id === id);

/** Descobre o nicho de uma loja pelo texto da categoria (ex.: "Hamburgueria artesanal" -> hamburgueria). */
export function nicheFromCategory(category: string): NicheId | undefined {
  const c = category.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const rules: [RegExp, NicheId][] = [
    [/acai|sorvet/, "acai_sorveteria"],
    [/hamburg|lanchon|burger/, "hamburgueria"],
    [/confeit|doceria|bolo/, "confeitaria"],
    [/padaria|panific/, "padaria"],
    [/restaurante|marmit|self/, "restaurante_balcao"],
    [/cafe/, "cafeteria"],
  ];
  return rules.find(([re]) => re.test(c))?.[1];
}

/**
 * Gera categorias e produtos do preset com ids novos para a loja.
 * codeStart: maior código já usado (os produtos recebem codeStart+1, +2…); orderStart: posição das novas categorias.
 */
export function buildPresetMenu(nicheId: NicheId, tenantId: string, opts: { codeStart?: number; orderStart?: number } = {}) {
  const niche = nicheById(nicheId)!;
  const categories: Category[] = niche.categories.map((c, i) => ({ id: uid("c_"), tenantId, name: c.name, icon: c.icon, order: (opts.orderStart ?? 0) + i + 1 }));
  const products: Product[] = niche.products.map(({ cat, groups = [], ...p }, i) => ({
    available: true,
    quickNotes: [],
    ...p,
    id: uid("p_"),
    tenantId,
    categoryId: categories[cat].id,
    code: String((opts.codeStart ?? 100) + i + 1),
    optionGroups: groups.map(
      (g): OptionGroup => ({
        id: uid("g_"),
        name: g.name,
        min: g.min,
        max: g.max,
        choices: g.choices.map((c) => (typeof c === "string" ? { id: uid("o_"), name: c, price: 0 } : { id: uid("o_"), name: c[0], price: c[1] })),
      }),
    ),
  }));
  return { categories, products };
}
