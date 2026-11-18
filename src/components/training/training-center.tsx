"use client";

/* eslint-disable @next/next/no-img-element -- prints reais servidos como arquivos estáticos */
import { ArrowLeft, BookOpen, CheckCircle2, Circle, Clock, ExternalLink, PlayCircle, Search, ThumbsDown, ThumbsUp, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { ARTICLES, TRAINING_VERSION, articleById } from "@/lib/training/articles";
import { markArticle, useProgress } from "@/lib/training/progress";
import { CHECKLIST, TOURS } from "@/lib/training/tours";
import type { Article, Persona } from "@/lib/training/types";
import { cn } from "@/lib/utils";
import { isStepDone } from "./activation-checklist";
import { runTour } from "./tour-runner";

const PERSONA_LABEL: Record<Persona, string> = {
  proprietario: "Proprietário",
  caixa: "Caixa",
  garcom: "Garçom",
  cozinha: "Cozinha/bar",
  atendente: "Atendente WhatsApp",
  cliente: "Cliente",
  "super-admin": "Super Admin",
};
// O painel da loja mostra só o que a equipe da loja usa (QA-20). Guias do Super Admin ficam fora.
const STORE_ARTICLES = ARTICLES.filter((a) => !a.roles.every((r) => r === "super-admin"));
const STORE_MODULES = [...new Set(STORE_ARTICLES.map((a) => a.module))];
const STORE_PERSONAS = (Object.keys(PERSONA_LABEL) as Persona[]).filter((p) => p !== "super-admin");

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const resolve = (route: string, slug: string) => route.replace("{slug}", slug);

export function TrainingCenter({ slug }: { slug: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const progress = useProgress(slug);
  const [q, setQ] = useState("");
  const [persona, setPersona] = useState<Persona | "todos">("todos");
  const [module, setModule] = useState<string>("todos");
  const current = params.get("artigo") ? articleById(params.get("artigo")!) : undefined;

  const list = useMemo(() => {
    const nq = norm(q.trim());
    return STORE_ARTICLES.filter(
      (a) =>
        (persona === "todos" || a.roles.includes(persona)) &&
        (module === "todos" || a.module === module) &&
        (!nq || norm(`${a.title} ${a.summary} ${a.module} ${a.steps.map((s) => s.text).join(" ")}`).includes(nq)),
    );
  }, [q, persona, module]);

  const done = Object.values(progress.articles).filter((a) => a.done).length;
  const open = (id: string) => router.push(`/painel/${slug}/treinamento?artigo=${id}`, { scroll: true });

  if (current) return <ArticleView article={current} slug={slug} />;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="cz-heading text-2xl font-bold">Central de treinamento</h1>
          <p className="text-sm text-cz-muted">
            {STORE_ARTICLES.length} guias com prints reais do sistema, {TOURS.length} tours guiados · versão {TRAINING_VERSION}
          </p>
        </div>
        <Badge tone="green">
          {done} de {STORE_ARTICLES.length} guias concluídos
        </Badge>
      </div>

      <Card className="grid gap-3">
        <h2 className="font-semibold">Primeiros passos da loja</h2>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {CHECKLIST.map((c) => {
            const ok = isStepDone(c.id, progress, { products: 0 });
            return (
              <li key={c.id}>
                <Link href={resolve(c.route, slug)} className="flex min-h-11 items-center gap-3 rounded-[10px] border border-cz-border px-3 py-2 text-sm hover:bg-cz-surface-2">
                  {ok ? <CheckCircle2 className="size-5 shrink-0 text-cz-success" aria-label="Concluído" /> : <Circle className="size-5 shrink-0 text-cz-muted" aria-label="Pendente" />}
                  <span className={cn(ok && "line-through opacity-70")}>{c.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <label className="relative block">
          <span className="sr-only">Buscar nos guias</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-cz-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: troco, QR Code, pausar produto, Pix"
            className="min-h-11 w-full rounded-[10px] border border-cz-border bg-cz-surface pl-10 pr-3 text-base"
            data-testid="busca-treinamento"
          />
        </label>
        <select aria-label="Filtrar por função" value={persona} onChange={(e) => setPersona(e.target.value as Persona | "todos")} className="min-h-11 rounded-[10px] border border-cz-border bg-cz-surface px-3">
          <option value="todos">Todas as funções</option>
          {STORE_PERSONAS.map((k) => (
            <option key={k} value={k}>
              {PERSONA_LABEL[k]}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por módulo" value={module} onChange={(e) => setModule(e.target.value)} className="min-h-11 rounded-[10px] border border-cz-border bg-cz-surface px-3">
          <option value="todos">Todos os módulos</option>
          {STORE_MODULES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>

      <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-live="polite" data-testid="lista-guias">
        {list.map((a) => {
          const cover = a.steps.find((s) => s.screenshot);
          return (
            <li key={a.id}>
              <button type="button" onClick={() => open(a.id)} className="group flex h-full w-full flex-col overflow-hidden rounded-[14px] border border-cz-border bg-cz-surface text-left transition hover:shadow-md">
                {cover?.screenshot && <img src={cover.screenshot} alt="" loading="lazy" className="aspect-[16/9] w-full border-b border-cz-border object-cover object-top" />}
                <span className="flex flex-1 flex-col gap-1.5 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-cz-gold-text">{a.module}</span>
                  <span className="font-semibold">{a.title}</span>
                  <span className="text-sm text-cz-muted">{a.summary}</span>
                  <span className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-cz-muted">
                    <Clock className="size-3.5" aria-hidden /> {a.estimatedMinutes} min · {a.steps.length} passos
                    {progress.articles[a.id]?.done && <Badge tone="green">Concluído</Badge>}
                    {a.simulation && <Badge tone="amber">Inclui simulação</Badge>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {!list.length && <li className="text-cz-muted">Nenhum guia encontrado para “{q}”.</li>}
      </ul>

      <Card className="grid gap-3">
        <h2 className="font-semibold">Tours guiados</h2>
        <p className="text-sm text-cz-muted">O tour abre a tela certa e destaca cada parte. Ele só mostra: nenhum botão é acionado.</p>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {TOURS.map((t) => (
            <li key={t.id}>
              <Link href={`${resolve(t.route, slug)}${resolve(t.route, slug).includes("?") ? "&" : "?"}tour=${t.id}`} className="flex min-h-11 items-center gap-2 rounded-[10px] border border-cz-border px-3 py-2 text-sm hover:bg-cz-surface-2">
                <PlayCircle className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{t.title}</span>
                {progress.tours[t.id]?.status === "completed" && <CheckCircle2 className="size-4 text-cz-success" aria-label="Concluído" />}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

type Boxes = Record<string, Record<string, { x: number; y: number; w: number; h: number }>>;

/** Posições reais das âncoras, medidas pelo script de captura junto com cada print. */
function useHighlightBoxes() {
  const [boxes, setBoxes] = useState<Boxes | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/training/screenshots/${TRAINING_VERSION}/highlights.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setBoxes(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return boxes;
}

function ArticleView({ article: a, slug }: { article: Article; slug: string }) {
  const progress = useProgress(slug);
  const boxes = useHighlightBoxes();
  const state = progress.articles[a.id];
  const tour = a.tourId ? TOURS.find((t) => t.id === a.tourId) : undefined;
  return (
    <article className="mx-auto grid max-w-4xl gap-6" aria-labelledby="art-title">
      <Link href={`/painel/${slug}/treinamento`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden /> Todos os guias
      </Link>
      <header className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-cz-gold-text">{a.module}</p>
        <h1 id="art-title" className="cz-heading text-3xl font-bold">
          {a.title}
        </h1>
        <p className="text-cz-muted">{a.summary}</p>
        <p className="flex flex-wrap items-center gap-3 text-sm text-cz-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" aria-hidden /> {a.estimatedMinutes} min
          </span>
          <span>Para: {a.roles.map((r) => PERSONA_LABEL[r]).join(", ")}</span>
          <span>Versão {a.version}</span>
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={resolve(a.route, slug)} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-brand px-4 text-sm font-semibold text-brand-ink">
            Abrir esta tela <ExternalLink className="size-4" aria-hidden />
          </Link>
          {tour && (
            <Link href={`${resolve(tour.route, slug)}?tour=${tour.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-cz-border px-4 text-sm font-semibold hover:bg-cz-surface-2">
              <PlayCircle className="size-4" aria-hidden /> Iniciar tour
            </Link>
          )}
        </div>
      </header>

      {a.simulation && (
        <p className="flex gap-2 rounded-[10px] border border-cz-warning/40 bg-cz-warning/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-cz-warning" aria-hidden />
          <span>
            <b>Simulação:</b> {a.simulation}
          </span>
        </p>
      )}
      {a.warning && (
        <p className="flex gap-2 rounded-[10px] border border-cz-error/40 bg-cz-error/10 p-3 text-sm" role="note">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-cz-error" aria-hidden />
          <span>
            <b>Atenção:</b> {a.warning}
          </span>
        </p>
      )}

      <ol className="grid gap-8">
        {a.steps.map((s, i) => (
          <li key={i} className="grid gap-3">
            <p className="flex gap-3">
              <span className="cz-heading grid size-8 shrink-0 place-items-center rounded-full bg-cz-navy text-sm font-bold text-white" aria-hidden>
                {i + 1}
              </span>
              <span className="pt-1">
                <span className="sr-only">Passo {i + 1}: </span>
                {s.text}
              </span>
            </p>
            {s.screenshot && (
              <figure className="ml-11">
                <div className="relative overflow-hidden rounded-[10px] border border-cz-border bg-white">
                  <img src={s.screenshot} alt={s.alt ?? ""} loading="lazy" className="block w-full" data-testid="print-treinamento" />
                  {s.highlight?.map((ref, k) => {
                    const h = boxes?.[s.screenshot!]?.[ref.anchor];
                    if (!h) return null;
                    return (
                    <span
                      key={k}
                      aria-hidden
                      className="pointer-events-none absolute rounded-md border-[3px] border-[#d4af6b] shadow-[0_0_0_3px_rgb(11_31_64/0.55)]"
                      style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%` }}
                    >
                      {ref.label && <span className="absolute -left-1 -top-3 rounded-full bg-[#0b1f40] px-2 py-0.5 text-xs font-bold text-white">{ref.label}</span>}
                    </span>
                    );
                  })}
                </div>
                {s.alt && <figcaption className="mt-1.5 text-xs text-cz-muted">{s.alt}</figcaption>}
              </figure>
            )}
          </li>
        ))}
      </ol>

      <Card className="grid gap-2">
        <h2 className="font-semibold">Resultado esperado</h2>
        <p className="text-sm">{a.expectedResult}</p>
      </Card>
      {a.commonErrors.length > 0 && (
        <Card className="grid gap-3">
          <h2 className="font-semibold">Problemas comuns</h2>
          <dl className="grid gap-3 text-sm">
            {a.commonErrors.map((e) => (
              <div key={e.problem}>
                <dt className="font-semibold">{e.problem}</dt>
                <dd className="text-cz-muted">{e.solution}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-cz-border pt-5">
        <Button variant={state?.done ? "secondary" : "brand"} onClick={() => markArticle(slug, a.id, { done: !state?.done })}>
          <CheckCircle2 className="size-4" aria-hidden /> {state?.done ? "Concluído (desfazer)" : "Marcar como concluído"}
        </Button>
        <span className="ml-auto text-sm text-cz-muted">Foi útil?</span>
        <button type="button" aria-pressed={state?.helpful === true} aria-label="Sim, foi útil" onClick={() => markArticle(slug, a.id, { helpful: true })} className={cn("grid size-11 place-items-center rounded-[10px] border border-cz-border", state?.helpful === true && "bg-cz-success/15")}>
          <ThumbsUp className="size-4" aria-hidden />
        </button>
        <button type="button" aria-pressed={state?.helpful === false} aria-label="Não foi útil" onClick={() => markArticle(slug, a.id, { helpful: false })} className={cn("grid size-11 place-items-center rounded-[10px] border border-cz-border", state?.helpful === false && "bg-cz-error/15")}>
          <ThumbsDown className="size-4" aria-hidden />
        </button>
      </div>

      {a.relatedGuides.length > 0 && (
        <nav aria-label="Próximos guias" className="grid gap-2">
          <h2 className="font-semibold">Próximos guias</h2>
          <ul className="flex flex-wrap gap-2">
            {a.relatedGuides.map((id) => {
              const r = articleById(id);
              return r ? (
                <li key={id}>
                  <Link href={`/painel/${slug}/treinamento?artigo=${id}`} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-cz-border px-3 text-sm hover:bg-cz-surface-2">
                    <BookOpen className="size-4" aria-hidden /> {r.title}
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        </nav>
      )}
    </article>
  );
}

/** Inicia o tour indicado em ?tour= quando a tela termina de carregar (links da central e dos artigos). */
export function TourFromQuery({ slug }: { slug: string }) {
  const params = useSearchParams();
  const id = params.get("tour");
  useEffect(() => {
    const tour = id ? TOURS.find((t) => t.id === id) : undefined;
    if (!tour) return;
    // Espera a primeira âncora do tour existir (tela hidratada) antes de iniciar; desiste após ~5 s.
    const first = tour.steps.find((s) => s.anchor)?.anchor;
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (!first || document.querySelector(`[data-tour="${first}"]`) || tries > 25) {
        clearInterval(timer);
        runTour(tour, slug);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [id, slug]);
  return null;
}
