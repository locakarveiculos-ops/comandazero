import "server-only";
import { cache } from "react";
import { READ_ONLY_AFTER_DAYS } from "@/lib/plans";
import { supabaseServer } from "@/lib/supabase/server";

export type SubscriptionState = {
  status: "trial" | "active" | "overdue" | "canceled";
  plan: "starter" | "pro" | "enterprise";
  cycle: "monthly" | "yearly";
  monthlyValue: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  overdueSince: string | null;
  /** Dias até o fim do teste (negativo = vencido). */
  trialDaysLeft: number | null;
  readOnly: boolean;
  /** Ativa e vence em menos de 10 dias: hora de renovar (InfinitePay não cobra sozinha). */
  renewSoon: boolean;
};

const DAY = 86_400_000;

/** Assinatura da loja vista pelo dono/gerente (RLS). Outros papéis recebem null e não veem cobrança. */
export const getSubscription = cache(async (tenantId: string): Promise<SubscriptionState | null> => {
  if (!tenantId) return null;
  const sb = await supabaseServer();
  const { data } = await sb.from("subscriptions").select("status, plan, cycle, monthly_value, trial_ends_at, current_period_end, overdue_since").eq("tenant_id", tenantId).maybeSingle();
  if (!data) return null;
  const now = Date.now();
  const trialDaysLeft = data.trial_ends_at ? Math.ceil((new Date(data.trial_ends_at).getTime() - now) / DAY) : null;
  // InfinitePay não tem recorrência: assinatura ativa com o período vencido conta como atraso desde o vencimento.
  const lapsed = data.status === "active" && !!data.current_period_end && new Date(data.current_period_end).getTime() < now;
  const status = lapsed ? "overdue" : data.status;
  const overdueSince = lapsed ? data.current_period_end : data.overdue_since;
  const overdueDays = overdueSince ? (now - new Date(overdueSince).getTime()) / DAY : 0;
  const readOnly = status === "canceled" || (status === "trial" && trialDaysLeft !== null && trialDaysLeft < 0) || (status === "overdue" && overdueDays > READ_ONLY_AFTER_DAYS);
  return {
    status,
    plan: data.plan,
    cycle: data.cycle,
    monthlyValue: data.monthly_value === null ? null : Number(data.monthly_value),
    trialEndsAt: data.trial_ends_at,
    currentPeriodEnd: data.current_period_end,
    overdueSince,
    trialDaysLeft,
    readOnly,
    renewSoon: status === "active" && !!data.current_period_end && new Date(data.current_period_end).getTime() - now < 10 * DAY,
  };
});
