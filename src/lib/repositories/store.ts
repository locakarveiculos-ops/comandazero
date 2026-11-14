"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { CATEGORIES, COUPONS, PRODUCTS, TENANTS, defaultIntegrations, defaultTables, demoOrders } from "../seed";
import type {
  CartItem,
  Category,
  Coupon,
  IntegrationSettings,
  LoyaltyCard,
  Order,
  Product,
  TableTab,
  Tenant,
} from "../types";
import { TAB_ID, emit } from "./events";

export const STORAGE_KEY = "comandazero-db";

export type DbData = {
  saasTheme: "light" | "dark";
  tenants: Tenant[];
  categories: Category[];
  products: Product[];
  orders: Order[];
  tables: TableTab[];
  coupons: Coupon[];
  loyalty: LoyaltyCard[];
  integrations: IntegrationSettings[];
  carts: Record<string, CartItem[]>;
  customer: { name: string; phone: string } | null;
  soundOn: boolean;
};

export const seedData = (): DbData => ({
  saasTheme: "light",
  tenants: structuredClone(TENANTS),
  categories: structuredClone(CATEGORIES),
  products: structuredClone(PRODUCTS),
  orders: demoOrders(),
  tables: TENANTS.flatMap(defaultTables),
  coupons: structuredClone(COUPONS),
  loyalty: [
    { tenantId: "t_cafe", phone: "5519999990001", name: "Mariana", stamps: 7, redeemed: 1, cashback: 4.2 },
    { tenantId: "t_cafe", phone: "5519999990002", name: "Rafael", stamps: 3, redeemed: 0, cashback: 1.35 },
    { tenantId: "t_burger", phone: "5519999990003", name: "Beatriz", stamps: 5, redeemed: 2, cashback: 0 },
  ],
  integrations: TENANTS.map((t) => defaultIntegrations(t.id)),
  carts: {},
  customer: null,
  soundOn: true,
});

let quotaListener: ((msg: string) => void) | null = null;
export const onStorageError = (fn: (msg: string) => void) => {
  quotaListener = fn;
};

// localStorage com proteção de cota: fotos enviadas pelo lojista podem estourar os ~5 MB do navegador.
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      quotaListener?.("Armazenamento do navegador cheio. Use imagens menores ou restaure os dados de demonstração.");
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* navegação privada sem storage: segue só em memória */
    }
  },
};

export const useDb = create<DbData>()(
  persist(seedData, {
    name: STORAGE_KEY,
    version: 2,
    // v1 (marca provisória) -> v2: troca brandId por saasTheme, mantendo pedidos e cadastros.
    migrate: (persisted) => {
      const { brandId: _old, ...rest } = (persisted ?? {}) as Partial<DbData> & { brandId?: string };
      void _old;
      return { ...seedData(), ...rest, saasTheme: rest.saasTheme ?? "light" } as DbData;
    },
    storage: createJSONStorage(() => safeStorage),
    skipHydration: true,
  }),
);

function readPersisted(): Partial<DbData> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw).state as Partial<DbData>) : null;
  } catch {
    return null;
  }
}

// Toda escrita parte do estado mais recente gravado por qualquer aba e grava UMA vez (ler e gravar no mesmo tique),
// evitando que uma aba sobrescreva o que outra acabou de salvar.
export function mutate(fn: (s: DbData) => Partial<DbData>) {
  const fresh = readPersisted();
  useDb.setState((s) => {
    const base = fresh ? { ...s, ...fresh } : s;
    return { ...base, ...fn(base) };
  });
  emit({ type: "db:update", origin: TAB_ID });
}

export function resetDb() {
  useDb.setState(seedData());
  emit({ type: "db:update", origin: TAB_ID });
}

// Só lê: rehydrate aplica o estado salvo sem regravar (regravar aqui apagava pedidos de outras abas).
export function reloadFromStorage() {
  void useDb.persist.rehydrate();
}
