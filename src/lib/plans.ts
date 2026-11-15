import type { Plan } from "@/lib/types";

/**
 * Fonte única dos planos e preços (landing, assinatura, Super Admin, calculadora).
 * Ids técnicos (starter/pro/enterprise) são os do banco (enum plan_tier); o nome comercial fica aqui.
 * Mudou preço: altere só este arquivo. Assinaturas já ativas guardam o valor contratado.
 */
export type PlanInfo = {
  id: Plan;
  name: string;
  monthly: number;
  /** Valor mensal equivalente no ciclo anual (cobrado em 12x esse valor por ano). */
  yearlyMonthly: number;
  tagline: string;
  stores: number;
  features: string[];
  popular?: boolean;
};

export const TRIAL_DAYS = 30;
/** Dias de atraso até o painel ficar só leitura. */
export const READ_ONLY_AFTER_DAYS = 7;
/** Preço de fundador: primeiras lojas pagantes do plano Profissional, travado enquanto a assinatura durar. */
export const FOUNDER_PRICE = 129.9;

export const PLANS: PlanInfo[] = [
  {
    id: "starter",
    name: "Essencial",
    monthly: 99.9,
    yearlyMonthly: 79.9,
    tagline: "Para começar a vender pelo próprio app",
    stores: 1,
    features: ["Cardápio digital instalável com a sua marca", "Pedidos de retirada, entrega e mesa", "Painel de pedidos e KDS da cozinha", "Mesas com QR Code", "0% de comissão por pedido"],
  },
  {
    id: "pro",
    name: "Profissional",
    monthly: 189.9,
    yearlyMonthly: 149.9,
    tagline: "Para quem quer automatizar o atendimento",
    stores: 1,
    popular: true,
    features: ["Tudo do Essencial", "WhatsApp da loja com avisos automáticos de pedido", "PDV de balcão", "Fidelidade e cupons", "Relatórios com exportação CSV", "Equipe com papéis (caixa, cozinha, garçom)"],
  },
  {
    id: "enterprise",
    name: "Rede",
    monthly: 299.9,
    yearlyMonthly: 249.9,
    tagline: "Para redes e lojas com mais de uma unidade",
    stores: 5,
    features: ["Tudo do Profissional", "Até 5 lojas na mesma conta", "Domínio próprio", "Suporte prioritário no WhatsApp"],
  },
];

export const planById = (id: Plan) => PLANS.find((p) => p.id === id) ?? PLANS[0];

export type Cycle = "monthly" | "yearly";
/** Valor cobrado por ciclo. */
export const cyclePrice = (p: PlanInfo, cycle: Cycle) => (cycle === "yearly" ? Math.round(p.yearlyMonthly * 12 * 100) / 100 : p.monthly);
/** Contribuição mensal para o MRR. */
export const monthlyValue = (p: PlanInfo, cycle: Cycle) => (cycle === "yearly" ? p.yearlyMonthly : p.monthly);
