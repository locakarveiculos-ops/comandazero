-- Fatura da assinatura registra em quantas parcelas o lojista pagou (definido no checkout da InfinitePay).
-- Mesmo padrão do Portaria Prime. Idempotente. Rollback no fim.

alter table public.subscription_invoices add column if not exists installments smallint;

create or replace function public.set_invoice_installments(p_invoice uuid, p_installments integer)
returns void language sql security definer set search_path = public as $$
  update subscription_invoices set installments = p_installments
   where id = p_invoice and status = 'paid' and p_installments between 1 and 12;
$$;
revoke all on function public.set_invoice_installments(uuid, integer) from public, anon, authenticated;
grant execute on function public.set_invoice_installments(uuid, integer) to service_role;

-- Rollback:
-- drop function if exists public.set_invoice_installments(uuid, integer);
-- alter table public.subscription_invoices drop column if exists installments;
