import { describe, expect, it } from "vitest";
import { PLANS, TRIAL_DAYS, cyclePrice } from "@/lib/plans";

describe("planos da plataforma", () => {
  it("oferece 30 dias de teste grátis", () => {
    expect(TRIAL_DAYS).toBe(30);
  });

  it("mantém os preços mensais e anuais de todos os planos", () => {
    expect(PLANS.map((p) => cyclePrice(p, "monthly"))).toEqual([99.9, 189.9, 299.9]);
    expect(PLANS.map((p) => cyclePrice(p, "yearly"))).toEqual([958.8, 1798.8, 2998.8]);
  });
});
