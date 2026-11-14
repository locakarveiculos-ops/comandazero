"use client";

/* eslint-disable @next/next/no-img-element -- logo e capa podem vir de upload */
import { Check, ImagePlus, TriangleAlert } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useStoreTenant } from "@/components/loja/use-store-tenant";
import { TenantTheme, displayFont } from "@/components/tenant-theme";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { ROOT_DOMAIN } from "@/config/saas-brand";
import { fileToDataUrl } from "@/lib/image";
import { updateTenant, useMenu } from "@/lib/repositories";
import type { Tenant } from "@/lib/types";
import { cn, contrastRatio, money, readableInk, slugify } from "@/lib/utils";

const PRESETS: { name: string; theme: Partial<Tenant["theme"]> }[] = [
  { name: "Café artesanal", theme: { paper: "#FAF6F0", surface: "#FFFFFF", ink: "#2C1A12", muted: "#6B5246", primary: "#2C1A12", secondary: "#5E7153", accent: "#C86D51", accentText: "#9C4A30", highlight: "#D49B4B", line: "#EADCCD", dark: false, fontDisplay: "serif" } },
  { name: "Neon noturno", theme: { paper: "#0E0E10", surface: "#18181B", ink: "#F4F4F5", muted: "#A1A1AA", primary: "#FF7A1A", secondary: "#FFB020", accent: "#FF7A1A", accentText: "#FF8F3D", highlight: "#FFB020", line: "#2A2A30", dark: true, fontDisplay: "sans" } },
  { name: "Padaria clara", theme: { paper: "#FFFBF2", surface: "#FFFFFF", ink: "#3B2410", muted: "#715A44", primary: "#B4541A", secondary: "#2F6B4F", accent: "#E39B3A", accentText: "#9A4A12", highlight: "#E39B3A", line: "#F0E3CC", dark: false, fontDisplay: "serif" } },
  { name: "Confeitaria rosa", theme: { paper: "#FFF6F8", surface: "#FFFFFF", ink: "#3A1A26", muted: "#7A4E5E", primary: "#B83A68", secondary: "#5E7C6B", accent: "#F2A7BD", accentText: "#A12E58", highlight: "#E7B04A", line: "#F6D8E1", dark: false, fontDisplay: "serif" } },
];

export default function AparenciaPage() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant } = useStoreTenant(slug);
  if (!tenant) return null;
  return <Editor key={tenant.id} tenant={tenant} />;
}

function Editor({ tenant }: { tenant: Tenant }) {
  const [draft, setDraft] = useState<Tenant>(tenant);
  const t = draft.theme;
  const { products } = useMenu(tenant.id);
  const preview = [...products.filter((p) => p.featured && p.available), ...products.filter((p) => !p.featured && p.available)].slice(0, 3);
  const setTheme = (patch: Partial<Tenant["theme"]>) => setDraft((d) => ({ ...d, theme: { ...d.theme, ...patch } }));
  const contrast = contrastRatio(t.primary, t.primaryInk);
  const bodyContrast = contrastRatio(t.paper, t.ink);

  const upload = async (field: "logo" | "cover", f?: File) => {
    if (!f) return;
    try {
      setDraft((d) => ({ ...d, [field]: "" }));
      const url = await fileToDataUrl(f, field === "logo" ? 400 : 1400);
      setDraft((d) => ({ ...d, [field]: url }));
    } catch (e) {
      toast.error((e as Error).message);
      setDraft((d) => ({ ...d, [field]: tenant[field] }));
    }
  };

  const save = () => {
    if (!/^[a-z0-9-]{3,30}$/.test(draft.subdomain)) return toast.error("Subdomínio: 3 a 30 letras minúsculas, números ou hífen");
    if (contrast < 4.5 || bodyContrast < 4.5) return toast.error("Ajuste as cores: o contraste mínimo é 4,5:1 para leitura (WCAG AA).");
    updateTenant(tenant.id, { name: draft.name, tagline: draft.tagline, logo: draft.logo, cover: draft.cover, theme: draft.theme, subdomain: draft.subdomain });
    toast.success("Marca do app atualizada no cardápio e no PWA");
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="cz-heading text-2xl font-bold">Marca do seu app</h1>
          <p className="text-sm text-cz-muted">Logo, cores e endereço do cardápio instalável. A prévia ao lado é exatamente o que o cliente vê.</p>
        </div>
        <Button variant="brand" onClick={save}>
          <Check className="size-4" aria-hidden /> Salvar e publicar
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="grid content-start gap-4">
          <Card className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
              <div className="grid gap-1.5">
                <span className="text-sm font-semibold">Logo</span>
                <label className="relative grid size-28 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed border-cz-border bg-cz-surface-2 focus-within:outline focus-within:outline-3 focus-within:outline-cz-info">
                  {draft.logo ? <img src={draft.logo} alt="Logo atual" className="size-full object-cover" /> : <ImagePlus className="size-6 text-cz-muted" aria-hidden />}
                  <input type="file" accept="image/*" className="sr-only" aria-label="Enviar logo" onChange={(e) => upload("logo", e.target.files?.[0])} />
                </label>
              </div>
              <div className="grid content-start gap-3">
                <Field label="Nome da loja" id="nm">
                  <Input id="nm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </Field>
                <Field label="Slogan" id="tg">
                  <Input id="tg" value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
                </Field>
              </div>
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-semibold">Foto de capa</span>
              <label className="relative block cursor-pointer overflow-hidden rounded-2xl bg-cz-surface-2 focus-within:outline focus-within:outline-3 focus-within:outline-cz-info">
                {draft.cover ? <img src={draft.cover} alt="" className="h-32 w-full object-cover" /> : <div className="h-32" />}
                <span className="absolute bottom-2 right-2 inline-flex min-h-9 items-center gap-1 rounded-full bg-white/95 px-3 text-sm font-semibold">
                  <ImagePlus className="size-4" aria-hidden /> Trocar capa
                </span>
                <input type="file" accept="image/*" className="sr-only" aria-label="Enviar capa" onChange={(e) => upload("cover", e.target.files?.[0])} />
              </label>
            </div>
          </Card>

          <Card className="grid gap-4">
            <h2 className="font-bold">Cores e tipografia</h2>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => setTheme(p.theme)} className="flex min-h-11 items-center gap-2 rounded-full border border-cz-border px-3 text-sm font-semibold hover:bg-cz-surface-2">
                  <span className="flex" aria-hidden>
                    {[p.theme.paper, p.theme.primary, p.theme.accent].map((c) => (
                      <span key={c} className="-ml-1 size-4 rounded-full border border-white first:ml-0" style={{ background: c }} />
                    ))}
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["primary", "Primária"],
                  ["secondary", "Secundária"],
                  ["accent", "Destaque"],
                  ["paper", "Fundo"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="grid gap-1.5 text-sm font-semibold">
                  {label}
                  <span className="flex min-h-11 items-center gap-2 rounded-xl border border-cz-border px-2">
                    <input
                      type="color"
                      value={t[k]}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTheme(k === "primary" ? { primary: v, primaryInk: readableInk(v) } : k === "accent" ? { accent: v, accentText: contrastRatio(v, t.paper) >= 4.5 ? v : t.accentText } : { [k]: v });
                      }}
                      className="size-8 cursor-pointer rounded border-0 bg-transparent"
                    />
                    <span className="font-mono text-xs uppercase">{t[k]}</span>
                  </span>
                </label>
              ))}
            </div>
            <Field label="Títulos" id="ft">
              <Select id="ft" value={t.fontDisplay} onChange={(e) => setTheme({ fontDisplay: e.target.value as "serif" | "sans" })}>
                <option value="serif">Serifada artesanal (Playfair Display)</option>
                <option value="sans">Moderna (Space Grotesk)</option>
              </Select>
            </Field>
            <ul className="grid gap-1.5 text-sm">
              <ContrastRow label="Botão principal" ratio={contrast} />
              <ContrastRow label="Texto sobre o fundo" ratio={bodyContrast} />
            </ul>
          </Card>

          <Card className="grid gap-3">
            <h2 className="font-bold">Endereço do app</h2>
            <Field label="Subdomínio" id="sd" hint="Funciona com Cloudflare/Vercel (wildcard). Domínio próprio: fale com o suporte.">
              <div className="flex items-center overflow-hidden rounded-xl border border-cz-border">
                <input id="sd" value={draft.subdomain} onChange={(e) => setDraft({ ...draft, subdomain: slugify(e.target.value).slice(0, 30) })} className="min-h-11 min-w-0 flex-1 px-3 text-base" />
                <span className="bg-cz-surface-2 px-3 py-3 text-sm text-cz-muted">.{ROOT_DOMAIN}</span>
              </div>
            </Field>
            <p className="text-sm text-cz-muted">
              Caminho alternativo, sem DNS: <code className="rounded bg-cz-surface-2 px-1.5">/loja/{tenant.slug}</code>
            </p>
          </Card>
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <p className="mb-2 text-center text-sm font-semibold text-cz-muted">Prévia no celular</p>
          <div className="mx-auto w-[320px] rounded-[44px] border-[10px] border-cz-text bg-cz-navy shadow-2xl" aria-label="Prévia do app no celular">
            <div className="h-[600px] overflow-hidden rounded-[34px]">
              <TenantTheme tenant={draft} className="h-full overflow-y-auto">
                <div className="relative h-28">
                  {draft.cover && <img src={draft.cover} alt="" className="size-full object-cover" />}
                </div>
                <div className="-mt-8 px-3">
                  <div className="rounded-2xl border border-line bg-surface p-3">
                    <div className="flex items-center gap-2">
                      {draft.logo && <img src={draft.logo} alt="" className="-mt-8 size-14 rounded-full border-4 border-surface bg-surface object-cover" />}
                      <div className="min-w-0">
                        <p className={cn("truncate text-lg font-bold text-ink", displayFont(draft))}>{draft.name}</p>
                        <p className="truncate text-[11px] text-muted">{draft.tagline}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-ink">Instalar app</span>
                      <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink">Aberto agora</span>
                    </div>
                  </div>
                  <p className={cn("mt-4 text-base font-bold text-ink", displayFont(draft))}>Destaques da casa</p>
                  {/* Prévia com os destaques reais do cardápio da loja (mesmos nomes, fotos e preços). */}
                  {preview.map((p) => (
                    <div key={p.id} className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface p-2">
                      <img src={p.image} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                        <p className="text-xs tabular-nums text-muted">{p.priceLabel ?? money(p.price)}</p>
                      </div>
                    </div>
                  ))}
                  {preview.length > 0 && (
                    <div className="mt-4 rounded-full bg-primary px-4 py-3 text-center text-sm font-bold text-primary-ink">
                      Ver carrinho · {money(preview.slice(0, 2).reduce((s, p) => s + p.price, 0))}
                    </div>
                  )}
                </div>
              </TenantTheme>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContrastRow({ label, ratio }: { label: string; ratio: number }) {
  const ok = ratio >= 4.5;
  return (
    <li className={cn("flex items-center gap-2", ok ? "text-cz-success" : "text-cz-error")}>
      {ok ? <Check className="size-4" aria-hidden /> : <TriangleAlert className="size-4" aria-hidden />}
      {label}: contraste {ratio.toLocaleString("pt-BR")}:1 {ok ? "(AA ok)" : "(abaixo de 4,5:1)"}
    </li>
  );
}
