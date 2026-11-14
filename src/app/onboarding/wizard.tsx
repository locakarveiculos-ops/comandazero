"use client";

import { ArrowLeft, ArrowRight, Check, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BrandLogo, SaasSurface } from "@/components/brand-switcher";
import { Button, Field, Input, Select } from "@/components/ui";
import { TRIAL_DAYS } from "@/lib/plans";
import { getSupabase } from "@/lib/supabase/client";
import { cn, formatPhone, isValidBrPhone, slugify } from "@/lib/utils";

const ERRORS: Record<string, string> = {
  SLUG_INVALIDO: "Endereço inválido. Use letras, números e hífen (mínimo 2 caracteres).",
  SLUG_EM_USO: "Esse endereço já está em uso. Escolha outro.",
  LIMITE_LOJAS: "Limite de 5 lojas por conta. Fale com o suporte.",
  SEM_LOGIN: "Sua sessão expirou. Entre na sua conta novamente.",
  NOME_INVALIDO: "Informe o nome da loja.",
  HORARIO_INVALIDO: "Confira o horário de funcionamento.",
  COR_INVALIDA: "Escolha uma cor válida.",
};
const STEPS = ["Sua loja", "Como vende", "Horário", "Aparência", "Cardápio"] as const;
const CATEGORIES = ["Cafeteria", "Padaria", "Confeitaria", "Lanchonete", "Hamburgueria", "Açaí", "Pizzaria", "Restaurante"];
const MODES = [
  { id: "retirada", label: "Retirada no balcão" },
  { id: "mesa", label: "Pedido na mesa (QR Code)" },
  { id: "delivery", label: "Entrega" },
  { id: "encomenda", label: "Encomendas com data" },
];
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PALETTES = [
  { name: "Café", primary: "#2C1A12", accent: "#C86D51" },
  { name: "Marinho", primary: "#0B1F40", accent: "#D4AF6B" },
  { name: "Verde", primary: "#1F3D2B", accent: "#7FA36B" },
  { name: "Vinho", primary: "#4A1420", accent: "#D98A6C" },
  { name: "Grafite", primary: "#1E1E1E", accent: "#F2B33D" },
];

/** Assistente de 5 passos. Tudo é validado de novo no banco (create_my_tenant_v2). */
export function OnboardingWizard({ defaultWhatsapp }: { defaultWhatsapp: string }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [category, setCategory] = useState("Cafeteria");
  const [whatsapp, setWhatsapp] = useState(formatPhone(defaultWhatsapp));
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("SP");
  const [modes, setModes] = useState<string[]>(["retirada", "mesa"]);
  const [open, setOpen] = useState("08:00");
  const [close, setClose] = useState("18:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [palette, setPalette] = useState(0);
  const [template, setTemplate] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const finalSlug = touched ? slug : slugify(name);

  const check = (s: number) => {
    if (s === 0) {
      if (name.trim().length < 2) return "Informe o nome da loja.";
      if (finalSlug.length < 2) return "Escolha o endereço do cardápio.";
      if (!isValidBrPhone(whatsapp)) return "Informe o WhatsApp da loja com DDD.";
      if (city.trim().length < 2) return "Informe a cidade.";
    }
    if (s === 1 && !modes.length) return "Escolha pelo menos uma forma de venda.";
    if (s === 2) {
      if (!days.length) return "Escolha os dias em que a loja abre.";
      if (open >= close) return "O horário de fechar precisa ser depois do de abrir.";
    }
    return "";
  };

  const next = () => {
    const e = check(step);
    setError(e);
    if (!e) setStep((s) => s + 1);
  };

  const finish = async () => {
    for (let s = 0; s < 3; s++) {
      const e = check(s);
      if (e) return (setStep(s), setError(e));
    }
    setLoading(true);
    const { data, error: err } = await getSupabase()!.rpc("create_my_tenant_v2", {
      p_name: name.trim(),
      p_slug: finalSlug,
      p_category: category,
      p_whatsapp: whatsapp,
      p_city: city.trim(),
      p_uf: uf,
      p_modes: modes,
      p_open: open,
      p_close: close,
      p_days: days,
      p_primary: PALETTES[palette].primary,
      p_accent: PALETTES[palette].accent,
      p_template: template,
    });
    setLoading(false);
    if (err) {
      const code = err.message.split(":")[0];
      if (code === "SLUG_EM_USO" || code === "SLUG_INVALIDO") setStep(0);
      return setError(ERRORS[code] ?? "Não foi possível criar a loja agora. Tente de novo.");
    }
    toast.success("Loja criada! Ela já está no ar.");
    window.location.assign(new URL(`/painel/${data as string}?bemvindo=1`, window.location.origin).href);
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const p = PALETTES[palette];

  return (
    <SaasSurface className="grid place-items-center px-4 py-8">
      <main id="conteudo" className="w-full max-w-xl">
        <BrandLogo variant="compact" height={30} className="mb-6" />
        <h1 className="cz-heading text-3xl font-bold">Criar minha loja</h1>
        <p className="mt-1 text-cz-muted">{TRIAL_DAYS} dias grátis, sem cartão. Você ajusta tudo depois no painel.</p>

        <ol className="mt-6 grid grid-cols-5 gap-1.5" aria-label="Etapas">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className="grid gap-1.5">
              <span className={cn("h-1.5 rounded-full", i <= step ? "bg-cz-gold" : "bg-cz-border")} aria-hidden />
              <span className={cn("text-xs", i === step ? "font-semibold" : "text-cz-muted")}>{s}</span>
            </li>
          ))}
        </ol>

        <section className="mt-6 rounded-[14px] border border-cz-border bg-cz-surface p-5" aria-labelledby="passo">
          <h2 id="passo" className="text-lg font-bold">
            Passo {step + 1} de 5 · {STEPS[step]}
          </h2>
          <div className="mt-4 grid gap-4">
            {step === 0 && (
              <>
                <Field label="Nome da loja" id="ob-nome">
                  <Input id="ob-nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Padaria Pão Dourado" autoComplete="organization" />
                </Field>
                <Field label="Endereço do cardápio" id="ob-slug" hint={finalSlug ? `comandazero.vercel.app/loja/${finalSlug}` : "Só letras, números e hífen"}>
                  <Input
                    id="ob-slug"
                    value={finalSlug}
                    onChange={(e) => {
                      setTouched(true);
                      setSlug(slugify(e.target.value));
                    }}
                    aria-describedby="ob-slug-hint"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Tipo de negócio" id="ob-cat">
                    <Select id="ob-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                      {CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="WhatsApp da loja" id="ob-wa">
                    <Input id="ob-wa" type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} placeholder="(19) 99999-0000" />
                  </Field>
                </div>
                <div className="grid grid-cols-[1fr_6rem] gap-4">
                  <Field label="Cidade" id="ob-city">
                    <Input id="ob-city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
                  </Field>
                  <Field label="UF" id="ob-uf">
                    <Input id="ob-uf" value={uf} maxLength={2} onChange={(e) => setUf(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} autoComplete="address-level1" />
                  </Field>
                </div>
              </>
            )}

            {step === 1 && (
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm text-cz-muted">Marque como o cliente pode pedir.</legend>
                {MODES.map((m) => (
                  <label key={m.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border border-cz-border px-3 has-[:checked]:border-cz-gold has-[:checked]:bg-cz-surface-2">
                    <input type="checkbox" className="size-5 accent-[#0b1f40]" checked={modes.includes(m.id)} onChange={() => setModes(toggle(modes, m.id))} />
                    {m.label}
                  </label>
                ))}
              </fieldset>
            )}

            {step === 2 && (
              <>
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Dias de funcionamento</legend>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={days.includes(i)}
                        onClick={() => setDays(toggle(days, i).sort())}
                        className={cn("min-h-11 min-w-12 rounded-[10px] border px-3 font-semibold", days.includes(i) ? "border-cz-navy bg-cz-navy text-white" : "border-cz-border")}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Abre às" id="ob-open">
                    <Input id="ob-open" type="time" value={open} onChange={(e) => setOpen(e.target.value)} />
                  </Field>
                  <Field label="Fecha às" id="ob-close">
                    <Input id="ob-close" type="time" value={close} onChange={(e) => setClose(e.target.value)} />
                  </Field>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Cores da loja</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {PALETTES.map((pl, i) => (
                      <button
                        key={pl.name}
                        type="button"
                        aria-pressed={palette === i}
                        onClick={() => setPalette(i)}
                        className={cn("grid min-h-16 justify-items-center gap-1 rounded-[10px] border p-2 text-sm", palette === i ? "border-cz-gold ring-2 ring-cz-gold" : "border-cz-border")}
                      >
                        <span className="flex gap-1" aria-hidden>
                          <span className="size-6 rounded-full" style={{ background: pl.primary }} />
                          <span className="size-6 rounded-full" style={{ background: pl.accent }} />
                        </span>
                        {pl.name}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="overflow-hidden rounded-[14px] border border-cz-border" aria-label="Prévia do topo do cardápio">
                  <div className="px-4 py-5 text-white" style={{ background: p.primary }}>
                    <p className="text-lg font-bold">{name.trim() || "Sua loja"}</p>
                    <p className="text-sm opacity-90">{category} · peça pelo app</p>
                  </div>
                  <div className="flex items-center justify-between bg-white px-4 py-3 text-[#2b2b2b]">
                    <span>Cappuccino</span>
                    <span className="rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ background: p.primary }}>
                      Adicionar
                    </span>
                  </div>
                </div>
                <p className="text-sm text-cz-muted">Logo, capa e fotos você envia depois em Aparência e Cardápio.</p>
              </>
            )}

            {step === 4 && (
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm text-cz-muted">Como você quer começar o cardápio?</legend>
                {[
                  { v: true, t: "Com cardápio modelo", d: "Cafés, doces e salgados com fotos. Você troca preços e remove o que não vende." },
                  { v: false, t: "Do zero", d: "Uma categoria vazia para você cadastrar seus produtos." },
                ].map((o) => (
                  <label key={String(o.v)} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[10px] border border-cz-border p-3 has-[:checked]:border-cz-gold has-[:checked]:bg-cz-surface-2">
                    <input type="radio" name="template" className="mt-1 size-5 accent-[#0b1f40]" checked={template === o.v} onChange={() => setTemplate(o.v)} />
                    <span>
                      <b>{o.t}</b>
                      <span className="block text-sm text-cz-muted">{o.d}</span>
                    </span>
                  </label>
                ))}
                <p className="mt-2 flex items-center gap-2 text-sm">
                  <Check className="size-4 text-cz-success" aria-hidden /> A loja vai para o ar assim que você concluir.
                </p>
              </fieldset>
            )}

            {error && (
              <p role="alert" className="text-sm font-semibold text-ui-error">
                {error}
              </p>
            )}
          </div>
        </section>

        <div className="mt-4 flex justify-between gap-2">
          <Button variant="ghost" onClick={() => (setError(""), setStep((s) => s - 1))} disabled={step === 0 || loading}>
            <ArrowLeft className="size-4" aria-hidden /> Voltar
          </Button>
          {step < 4 ? (
            <Button variant="brand" onClick={next}>
              Continuar <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button variant="brand" size="lg" onClick={finish} loading={loading}>
              <Store className="size-4" aria-hidden /> Criar loja
            </Button>
          )}
        </div>
      </main>
    </SaasSurface>
  );
}
