export type OrderMode = "delivery" | "retirada" | "mesa" | "encomenda" | "balcao";
export type OrderStatus = "recebido" | "preparo" | "pronto" | "saiu" | "entregue" | "cancelado";
export type PaymentStatus = "pendente" | "pago" | "parcial" | "estornado";
export type PaymentMethod = "pix" | "cartao_credito" | "cartao_debito" | "dinheiro" | "vale_refeicao" | "link";
export type GatewayId = "infinitepay" | "asaas" | "mercadopago" | "pagbank" | "stone" | "presencial";
export type Plan = "starter" | "pro" | "enterprise";
export type Channel = "loja" | "mesa" | "balcao" | "delivery" | "whatsapp";

export type TenantTheme = {
  paper: string;
  surface: string;
  ink: string;
  muted: string;
  primary: string;
  primaryInk: string;
  secondary: string;
  accent: string; // decorativo / fundos de destaque
  accentText: string; // versão do acento com contraste AA sobre o fundo
  highlight: string;
  line: string;
  dark: boolean;
  fontDisplay: "serif" | "sans";
};

export type OpeningHour = { day: number; open: string; close: string }; // day 0=domingo

export type DeliveryZone = { id: string; bairro: string; fee: number; minutes: number };

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  logo: string;
  cover: string;
  theme: TenantTheme;
  whatsapp: string;
  instagram: string;
  address: { street: string; district: string; city: string; uf: string; cep: string; complement?: string };
  hours: OpeningHour[];
  prepMinutes: number;
  rating: number;
  ratingCount: number;
  modes: OrderMode[];
  deliveryZones: DeliveryZone[];
  deliveryPerKm: number;
  minOrder: number;
  tables: number;
  subdomain: string;
  customDomain?: string;
  plan: Plan;
  active: boolean;
  createdAt: string;
  loyalty: { enabled: boolean; goal: number; reward: string; categoryIds: string[]; cashbackPct: number };
  /** Loja de demonstração: dados só no navegador. Lojas reais (false) usam o Supabase. */
  isDemo?: boolean;
  /** Loja real: formas aceitas no carrinho (sem a chave Pix), lidas pelo servidor. */
  paymentOptions?: { pix: boolean; presencial: boolean; vr: string[] };
};

export type OptionChoice = { id: string; name: string; price: number };
export type OptionGroup = {
  id: string;
  name: string;
  min: number;
  max: number;
  choices: OptionChoice[];
};

export type CakeConfig = {
  minKg: number;
  maxKg: number;
  pricePerKg: number;
  massas: string[];
  recheios: string[];
  coberturas: string[];
  leadHours: number;
  depositPct: number;
};

export type Product = {
  id: string;
  tenantId: string;
  categoryId: string;
  code: string;
  name: string;
  description: string;
  badge?: string;
  price: number;
  priceLabel?: string;
  image: string;
  available: boolean;
  featured?: boolean;
  optionGroups: OptionGroup[];
  quickNotes: string[];
  cake?: CakeConfig;
  preorder?: { leadHours: number; depositPct: number };
  stock?: number | null;
};

export type Category = { id: string; tenantId: string; name: string; icon: string; order: number };

export type CartItemOption = { groupId: string; groupName: string; choiceId: string; name: string; price: number };

export type CakeOrder = {
  kg: number;
  massa: string;
  recheio: string;
  cobertura: string;
  frase: string;
  pickupAt: string;
};

export type CartItem = {
  key: string;
  productId: string;
  name: string;
  image: string;
  unitPrice: number;
  qty: number;
  options: CartItemOption[];
  notes: string;
  cake?: CakeOrder;
  /** Item da comanda que já virou pedido pelo QR da mesa (não é faturado de novo ao fechar). */
  orderId?: string;
};

export type PaymentSplit = { method: PaymentMethod; amount: number; gateway?: GatewayId };

export type Order = {
  id: string;
  number: number;
  tenantId: string;
  channel: Channel;
  mode: OrderMode;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  payments: PaymentSplit[];
  paymentMethod: PaymentMethod;
  gateway: GatewayId;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  changeFor?: number;
  customer: { name: string; phone: string };
  address?: { cep: string; street: string; number: string; district: string; city: string; complement?: string };
  table?: string;
  scheduledFor?: string;
  deposit?: number;
  coupon?: string;
  createdAt: string;
  updatedAt: string;
  history: { status: OrderStatus; at: string }[];
  seen: boolean;
  /** Token de acompanhamento (pedidos de loja real; vai na URL do cliente). */
  trackToken?: string;
};

export type TableState = "livre" | "ocupada" | "conta";
export type TableTab = {
  tenantId: string;
  number: string;
  state: TableState;
  openedAt?: string;
  items: CartItem[];
  people: number;
};

export type Coupon = {
  id: string;
  tenantId: string;
  code: string;
  type: "percent" | "fixed" | "frete";
  value: number;
  minOrder: number;
  active: boolean;
  uses: number;
};

export type LoyaltyCard = { tenantId: string; phone: string; name: string; stamps: number; redeemed: number; cashback: number };

export type WhatsappProvider = "whaileys" | "evolution";
export type WhatsappTrigger = "recebido" | "preparo" | "pronto" | "saiu" | "pos_venda";

export type IntegrationSettings = {
  tenantId: string;
  whatsapp: {
    provider: WhatsappProvider;
    enabled: boolean;
    evolution: { baseUrl: string; instance: string; apiKeyRef: string };
    triggers: Record<WhatsappTrigger, { enabled: boolean; template: string }>;
  };
  payments: {
    pixGateway: GatewayId;
    cardGateway: GatewayId;
    gateways: Record<GatewayId, { enabled: boolean; mode: "sandbox" | "producao"; keyRef: string; split: boolean }>;
    acceptVR: string[];
    /** Aceita vale-refeição no checkout (bandeiras em acceptVR). Ausente = não aceita. */
    vrEnabled?: boolean;
    /** Pix com chave própria (sem Conexão Automática): chave e nome de quem recebe. */
    pixKey?: string;
    pixName?: string;
  };
  email: { enabled: boolean; fromName: string; subdomain: string; verified: boolean; ownerEmail: string };
};
