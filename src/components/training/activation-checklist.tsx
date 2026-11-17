"use client";

import { CheckCircle2, ChevronDown, ChevronUp, Circle, FlaskConical, Link2, PlayCircle, Rocket } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Modal } from "@/components/ui";
import { createTestOrder, useStoreMenu } from "@/lib/repositories/engine";
import { markStep, updateProgress, useProgress, type Progress } from "@/lib/training/progress";
import { CHECKLIST, TOURS } from "@/lib/training/tours";
import type { Tenant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { routeKey } from "./help-button";
import { runTour } from "./tour-runner";

/** Passos que valem para esta loja (QR das mesas só aparece para quem atende em mesa). */
export const stepsFor = (tenant: Pick<Tenant, "modes">) => CHECKLIST.filter((c) => c.id !== "mesas" || tenant.modes.includes("mesa"));

/** Passo concluído: marcado pela própria tela, artigo lido ou detectado (cardápio com produtos). */
export function isStepDone(id: string, progress: Progress, ctx: { products: number }) {
  if (id === "cardapio" && ctx.products > 0) return true;
  const c = CHECKLIST.find((x) => x.id === id);
  return !!progress.checklist[id] || (!!c?.articleId && !!progress.articles[c.articleId]?.done);
}

export function useActivation(tenant: Tenant) {
  const progress = useProgress(tenant.slug);
  const { products } = useStoreMenu(tenant);
  const steps = stepsFor(tenant).map((s) => ({ ...s, done: isStepDone(s.id, progress, { products: products.length }) }));
  const pct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
  return { steps, pct, progress, products };
}

/** Pedido de teste em 1 clique: cria e leva para a Tela da Cozinha, onde o guia continua. */
export function useTestOrder(tenant: Tenant) {
  const router = useRouter();
  const { products } = useStoreMenu(tenant);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const o = await createTestOrder(tenant, products);
      updateProgress(tenant.slug, (p) => ({ ...p, testOrder: { id: o.id, number: o.number } }));
      toast.success(`Pedido de teste #${o.number} enviado para a cozinha`);
      router.push(`/painel/${tenant.slug}/kds`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}

function StepList({ tenant, steps, onNavigate }: { tenant: Tenant; steps: ReturnType<typeof useActivation>["steps"]; onNavigate?: () => void }) {
  const test = useTestOrder(tenant);
  const resolve = (r: string) => r.replace("{slug}", tenant.slug);
  const copyLink = async () => {
    const url = `${window.location.origin}/loja/${tenant.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link do cardápio copiado. Cole no WhatsApp e no Instagram.");
    } catch {
      toast.info(url);
    }
    markStep(tenant.slug, "link");
  };
  return (
    <ul className="grid gap-1.5">
      {steps.map((s) => {
        const icon = s.done ? <CheckCircle2 className="size-5 shrink-0 text-cz-success" aria-hidden /> : <Circle className="size-5 shrink-0 text-cz-muted" aria-hidden />;
        const label = (
          <>
            {icon}
            <span className={cn("flex-1", s.done && "text-cz-muted line-through")}>{s.title}</span>
            <span className="sr-only">{s.done ? "(concluído)" : "(pendente)"}</span>
          </>
        );
        const cls = "flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-sm transition hover:bg-cz-surface-2";
        if (s.id === "pedido-teste" && !s.done)
          return (
            <li key={s.id}>
              <button type="button" className={cls} onClick={() => (onNavigate?.(), void test.run())} disabled={test.busy}>
                {label}
                <FlaskConical className="size-4 text-cz-gold-text" aria-hidden />
              </button>
            </li>
          );
        if (s.id === "link")
          return (
            <li key={s.id}>
              <button type="button" className={cls} onClick={copyLink}>
                {label}
                <Link2 className="size-4 text-cz-muted" aria-hidden />
              </button>
            </li>
          );
        return (
          <li key={s.id}>
            <Link href={resolve(s.route)} className={cls} onClick={onNavigate}>
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-cz-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Loja pronta para vender">
      <div className="h-full rounded-full bg-cz-success transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Cartão do Dashboard: minimizável, some quando a loja está 100% pronta e o dono dispensa. */
export function ActivationCard({ tenant }: { tenant: Tenant }) {
  const { steps, pct, progress } = useActivation(tenant);
  const test = useTestOrder(tenant);
  if (pct === 100 && progress.checklistCollapsed) return null;
  const collapsed = !!progress.checklistCollapsed;
  const setCollapsed = (v: boolean) => updateProgress(tenant.slug, (p) => ({ ...p, checklistCollapsed: v }));
  const nextStep = steps.find((s) => !s.done);
  return (
    <section aria-labelledby="ativacao-titulo" data-tour="ativacao" className="rounded-[14px] border border-cz-border bg-cz-surface p-4 shadow-[0_8px_30px_rgb(11_31_64/0.06)] sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Rocket className="size-6 text-cz-gold-text" aria-hidden />
        <div className="min-w-48 flex-1">
          <h2 id="ativacao-titulo" className="font-bold">
            Sua loja está {pct}% pronta para vender
          </h2>
          <p className="text-sm text-cz-muted">{nextStep ? `Próximo passo: ${nextStep.title}.` : "Tudo pronto! Divulgue o link e boas vendas."}</p>
        </div>
        {nextStep?.id === "pedido-teste" && (
          <Button variant="brand" size="sm" onClick={test.run} loading={test.busy}>
            <FlaskConical className="size-4" aria-hidden /> Fazer pedido de teste
          </Button>
        )}
        <Button variant="ghost" size="sm" aria-expanded={!collapsed} aria-controls="ativacao-lista" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronDown className="size-4" aria-hidden /> : <ChevronUp className="size-4" aria-hidden />}
          {collapsed ? "Mostrar passos" : pct === 100 ? "Dispensar" : "Minimizar"}
        </Button>
      </div>
      <div className="mt-3">
        <Bar pct={pct} />
      </div>
      {!collapsed && (
        <div id="ativacao-lista" className="mt-3">
          <StepList tenant={tenant} steps={steps} />
        </div>
      )}
    </section>
  );
}

/** Botão fixo no topo do painel: mostra o % em qualquer tela e abre os passos + tour desta tela. */
export function ActivationButton({ tenant }: { tenant: Tenant }) {
  const { steps, pct } = useActivation(tenant);
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const tour = TOURS.find((t) => t.route === routeKey(path, tenant.slug));
  if (pct === 100) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="ativacao"
        aria-label={`Sua loja está ${pct}% pronta. Ver passos`}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-cz-border bg-cz-surface px-3 text-sm font-semibold transition hover:bg-cz-surface-2"
      >
        <Rocket className="size-4 text-cz-gold-text" aria-hidden />
        <span className="hidden tabular-nums sm:inline">{pct}%</span>
      </button>
      <Modal open={open} onOpenChange={setOpen} title={`Sua loja está ${pct}% pronta para vender`} description="Faça os passos na ordem. Dá para voltar aqui de qualquer tela." side="right">
        <div className="grid gap-4 p-5">
          <Bar pct={pct} />
          <StepList tenant={tenant} steps={steps} onNavigate={() => setOpen(false)} />
          {tour && (
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setTimeout(() => runTour(tour, tenant.slug), 180);
              }}
            >
              <PlayCircle className="size-4" aria-hidden /> Retomar o tour desta tela
            </Button>
          )}
        </div>
      </Modal>
    </>
  );
}
