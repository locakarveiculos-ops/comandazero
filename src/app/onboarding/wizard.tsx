"use client";

/* eslint-disable @next/next/no-img-element -- prévia usa fotos do preset e logo enviada (data URL) */
import { ArrowLeft, ArrowRight, Banknote, Beef, CakeSlice, Check, ChefHat, Coffee, CreditCard, IceCreamBowl, ImagePlus, QrCode, Store, UtensilsCrossed, Wheat } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandLogo, SaasSurface } from "@/components/brand-switcher";
import { Button, Field, Input } from "@/components/ui";
import { ROOT_DOMAIN } from "@/config/saas-brand";
import { useClientValue } from "@/lib/use-client";
import { dataUrlToFile, fileToDataUrl } from "@/lib/image";
import { NICHES, buildPresetMenu, type NicheId } from "@/lib/niche-presets";
import { normalizePixKey } from "@/lib/pix";
import { TRIAL_DAYS } from "@/lib/plans";
import { remoteSeedMenu, remoteUploadImage } from "@/lib/repositories/remote";
import { defaultIntegrations } from "@/lib/seed";
import { getSupabase } from "@/lib/supabase/client";
import { updateProgress } from "@/lib/training/progress";
import type { OrderMode } from "@/lib/types";
import { cn, formatPhone, isValidBrPhone, money, readableInk, slugify, slugifyTyping } from "@/lib/utils";

const ERRORS: Record<string, string> = {
  SLUG_INVALIDO: "Endereço inválido. Use letras, números e hífen (mínimo 2 caracteres).",
  SLUG_EM_USO: "Esse endereço já está em uso. Escolha outro.",
  LIMITE_LOJAS: "Limite de 5 lojas por conta. Fale com o suporte.",
  SEM_LOGIN: "Sua sessão expirou. Entre na sua conta novamente.",
  NOME_INVALIDO: "Informe o nome da loja.",
  HORARIO_INVALIDO: "Confira o horário de funcionamento.",
  COR_INVALIDA: "Escolha uma cor válida.",
};
const STEPS = ["Sua loja", "Aparência", "Cardápio", "Recebimento", "Primeiro pedido"] as const;
const ICON: Record<NicheId, typeof Coffee> = { cafeteria: Coffee, padaria: Wheat, confeitaria: CakeSlice, hamburgueria: Beef, acai_sorveteria: IceCreamBowl, restaurante_balcao: UtensilsCrossed };
const SERVE: { id: OrderMode; label: string; hint: string }[] = [
  { id: "retirada", label: "Balcão / Retirada", hint: "O cliente pede e retira no balcão" },
  { id: "mesa", label: "Mesas e comandas", hint: "QR Code em cada mesa, conta por mesa" },
  { id: "delivery", label: "Delivery", hint: "Entrega com taxa no endereço do cliente" },
];
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
// Paleta neutra extra; nomes repetidos com o nicho são filtrados (QA-26).
const EXTRA_PALETTES = [{ name: "Azul-marinho", primary: "#0B1F40", accent: "#D4AF6B" }];

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const parseMoney = (v: string) => Number(v.replace(/\./g, "").replace(",", "."));

/* ---------- Rascunho do assistente (QA-06) ---------- */

type WizardDraft = {
  step: number; niche: NicheId; name: string; slug: string; touched: boolean; whatsapp: string; city: string; uf: string;
  modes: OrderMode[]; fee: string; open: string; close: string; days: number[]; palette: number; template: boolean;
  pixKey: string; pixName: string; cash: boolean; card: boolean;
};
const DRAFT_KEY = "cz-onboarding-rascunho";
const draftDefaults = (whatsapp: string): WizardDraft => ({
  step: 0, niche: "cafeteria", name: "", slug: "", touched: false, whatsapp: formatPhone(whatsapp), city: "", uf: "SP",
  modes: NICHES[0].modes, fee: "5,00", open: "08:00", close: "18:00", days: [1, 2, 3, 4, 5, 6], palette: 0, template: true,
  pixKey: "", pixName: "", cash: true, card: true,
});
// Getter estável para useClientValue: lê o storage uma única vez por carregamento da página.
let firstRead: string | null | undefined;
function readDraftOnce() {
  if (firstRead === undefined) {
    try {
      firstRead = sessionStorage.getItem(DRAFT_KEY);
    } catch {
      firstRead = null;
    }
  }
  return firstRead;
}
function parseDraft(raw: string | null): Partial<WizardDraft> {
  if (!raw) return {};
  try {
    const d = JSON.parse(raw) as Partial<WizardDraft>;
    // Rascunho de outra versão do assistente: só aproveita campos com o tipo certo.
    return Object.fromEntries(Object.entries(d).filter(([k, v]) => typeof v === typeof draftDefaults("")[k as keyof WizardDraft])) as Partial<WizardDraft>;
  } catch {
    return {};
  }
}
// sessionStorage: some ao fechar a aba (não deixa chave Pix guardada no aparelho depois).
function saveDraft(d: WizardDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* sem storage: segue sem rascunho */
  }
}
function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* sem storage */
  }
}

/* ---------- Validação por campo (QA-13) ---------- */

type FieldErrors = Partial<Record<"name" | "slug" | "whatsapp" | "city" | "modes" | "fee" | "days" | "hours" | "pixKey" | "pixName" | "receive" | "submit", string>>;
const FIELD_ID: Record<keyof FieldErrors, string> = {
  name: "ob-nome", slug: "ob-slug", whatsapp: "ob-wa", city: "ob-city", modes: "ob-mode-retirada", fee: "ob-fee",
  days: "ob-day-1", hours: "ob-close", pixKey: "ob-pix", pixName: "ob-pixname", receive: "ob-cash", submit: "ob-submit",
};

export function validateStep(
  s: number,
  v: { name: string; slug: string; whatsapp: string; city: string; modes: OrderMode[]; fee: string; days: number[]; open: string; close: string; pixKey: string; pixName: string; cash: boolean; card: boolean },
): FieldErrors {
  const e: FieldErrors = {};
  if (s === 0) {
    if (v.name.trim().length < 2) e.name = "Informe o nome da loja.";
    if (v.slug.length < 2) e.slug = "Escolha o endereço do cardápio (mínimo 2 letras).";
    if (!isValidBrPhone(v.whatsapp)) e.whatsapp = "Informe o WhatsApp da loja com DDD, ex.: (19) 99999-0000.";
    if (v.city.trim().length < 2) e.city = "Informe a cidade.";
    if (!v.modes.some((m) => SERVE.some((x) => x.id === m))) e.modes = "Escolha pelo menos uma forma de atender.";
    if (v.modes.includes("delivery") && !(parseMoney(v.fee) >= 0)) e.fee = "Informe a taxa de entrega (pode ser 0).";
    if (!v.days.length) e.days = "Escolha os dias em que a loja abre.";
    if (v.open >= v.close) e.hours = "O horário de fechar precisa ser depois do de abrir.";
  }
  if (s === 3) {
    if (v.pixKey.trim() && !normalizePixKey(v.pixKey)) e.pixKey = "Chave Pix inválida. Use CPF, CNPJ, e-mail, celular com DDD ou chave aleatória.";
    if (v.pixKey.trim() && v.pixName.trim().length < 2) e.pixName = "Informe o nome de quem recebe o Pix.";
    if (!v.pixKey.trim() && !v.cash && !v.card) e.receive = "Escolha pelo menos uma forma de receber.";
  }
  return e;
}

/** Assistente "do zero ao primeiro pedido" em 5 passos. A loja é validada de novo no banco (create_my_tenant_v2). */
/**
 * O servidor renderiza o assistente vazio; o rascunho salvo só existe no navegador. Ler o localStorage no
 * primeiro render quebraria a hidratação, então o assistente monta depois de ler o rascunho (key = rascunho).
 */
export function OnboardingWizard({ defaultWhatsapp }: { defaultWhatsapp: string }) {
  // Lido uma vez ao montar no navegador (useClientValue com getter estável: snapshot do primeiro acesso).
  const saved = useClientValue(readDraftOnce, null);
  const hydrated = useClientValue(() => true, false);
  if (!hydrated) return <Wizard key="servidor" defaultWhatsapp={defaultWhatsapp} saved={null} />;
  return <Wizard key="navegador" defaultWhatsapp={defaultWhatsapp} saved={saved} />;
}

function Wizard({ defaultWhatsapp, saved }: { defaultWhatsapp: string; saved: string | null }) {
  // Rascunho salvo (recarregou a página): cada campo começa do que já estava preenchido.
  const [d] = useState(() => ({ ...draftDefaults(defaultWhatsapp), ...parseDraft(saved) }));
  const [step, setStep] = useState(d.step);
  const [niche, setNiche] = useState<NicheId>(d.niche);
  const preset = NICHES.find((n) => n.id === niche)!;
  const [name, setName] = useState(d.name);
  const [slug, setSlug] = useState(d.slug);
  const [touched, setTouched] = useState(d.touched);
  const [whatsapp, setWhatsapp] = useState(d.whatsapp);
  const [city, setCity] = useState(d.city);
  const [uf, setUf] = useState(d.uf);
  const [modes, setModes] = useState<OrderMode[]>(d.modes);
  const [fee, setFee] = useState(d.fee);
  const [open, setOpen] = useState(d.open);
  const [close, setClose] = useState(d.close);
  const [days, setDays] = useState<number[]>(d.days);
  const [palette, setPalette] = useState(d.palette);
  const [logo, setLogo] = useState("");
  const [template, setTemplate] = useState(d.template);
  const [pixKey, setPixKey] = useState(d.pixKey);
  const [pixName, setPixName] = useState(d.pixName);
  const [cash, setCash] = useState(d.cash);
  const [card, setCard] = useState(d.card);
  // Erro por campo (QA-13): a mensagem fica junto do campo e o foco vai para ele.
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  // Conta no limite de lojas: avisa logo ao abrir (QA-05), não no último passo.
  const [blocked, setBlocked] = useState("");
  const finalSlug = slugify(touched ? slug : name);
  const palettes = [...preset.palettes, ...EXTRA_PALETTES.filter((x) => !preset.palettes.some((p) => p.primary === x.primary))];
  const pal = palettes[palette] ?? palettes[0];

  // Recarregar a página não perde o que foi preenchido (QA-06). A logo não entra: imagem grande estoura o storage.
  const draft: WizardDraft = { step, niche, name, slug, touched, whatsapp, city, uf, modes, fee, open, close, days, palette, template, pixKey, pixName, cash, card };
  useEffect(() => saveDraft(draft));

  useEffect(() => {
    let alive = true;
    void getSupabase()
      ?.rpc("onboarding_check", { p_slug: "" })
      .then(({ data }) => alive && (data as { code?: string } | null)?.code === "LIMITE_LOJAS" && setBlocked(ERRORS.LIMITE_LOJAS));
    return () => {
      alive = false;
    };
  }, []);

  // aria-invalid + descrição do erro no próprio campo.
  const invalid = (k: keyof FieldErrors, id: string) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {});

  const pickNiche = (id: NicheId) => {
    setNiche(id);
    setModes(NICHES.find((n) => n.id === id)!.modes);
    setPalette(0);
  };

  const check = (s: number) => validateStep(s, { name, slug: finalSlug, whatsapp, city, modes, fee, days, open, close, pixKey, pixName, cash, card });

  const showErrors = (e: FieldErrors) => {
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) requestAnimationFrame(() => document.getElementById(FIELD_ID[first as keyof FieldErrors] ?? "")?.focus());
  };

  const next = async () => {
    const e = check(step);
    if (Object.keys(e).length) return showErrors(e);
    if (step === 0) {
      // Endereço em uso e limite de lojas conferidos no banco antes de seguir (QA-04, QA-05).
      setChecking(true);
      const { data } = (await getSupabase()?.rpc("onboarding_check", { p_slug: finalSlug })) ?? { data: null };
      setChecking(false);
      const code = (data as { code?: string } | null)?.code;
      if (code === "LIMITE_LOJAS") return setBlocked(ERRORS.LIMITE_LOJAS);
      if (code === "SLUG_EM_USO" || code === "SLUG_INVALIDO") return showErrors({ slug: ERRORS[code] });
    }
    setErrors({});
    setStep((s) => s + 1);
  };

  const onLogo = async (f?: File) => {
    if (!f) return;
    try {
      setLogo(await fileToDataUrl(f, 400));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const finish = async () => {
    for (const s of [0, 3]) {
      const e = check(s);
      if (Object.keys(e).length) return (setStep(s), showErrors(e));
    }
    setLoading(true);
    const sb = getSupabase()!;
    const { data, error: err } = await sb.rpc("create_my_tenant_v2", {
      p_name: name.trim(),
      p_slug: finalSlug,
      p_category: preset.label,
      p_whatsapp: whatsapp,
      p_city: city.trim(),
      p_uf: uf,
      p_modes: modes,
      p_open: open,
      p_close: close,
      p_days: days,
      p_primary: pal.primary,
      p_accent: pal.accent,
      // Cardápio do nicho é criado abaixo (o modelo do banco é só de cafeteria).
      p_template: false,
    });
    if (err) {
      setLoading(false);
      const code = err.message.split(":")[0];
      if (code === "LIMITE_LOJAS") return setBlocked(ERRORS.LIMITE_LOJAS);
      if (code === "SLUG_EM_USO" || code === "SLUG_INVALIDO") return (setStep(0), showErrors({ slug: ERRORS[code] }));
      if (!ERRORS[code]) console.error("[onboarding]", err.message);
      return setErrors({ submit: ERRORS[code] ?? "Não foi possível criar a loja agora. Tente de novo ou fale com o suporte." });
    }
    clearDraft();
    const newSlug = data as string;
    // A loja já existe: daqui em diante cada parte que falhar vira aviso, nunca perda do que já foi criado.
    const warn: string[] = [];
    const { data: t } = await sb.from("tenants").select("id").eq("slug", newSlug).maybeSingle();
    if (t) {
      const tenantPatch: Record<string, unknown> = {};
      if (template) {
        try {
          const menu = buildPresetMenu(niche, t.id);
          const ids = await remoteSeedMenu(t.id, menu);
          await sb.from("categories").delete().eq("tenant_id", t.id).eq("name", "Destaques");
          if (preset.features.loyalty) tenantPatch.loyalty = { enabled: true, goal: 10, reward: preset.loyaltyReward, categoryIds: [ids.get(menu.categories[0].id)], cashbackPct: 0 };
        } catch {
          warn.push("cardápio de exemplo (carregue em Cardápio)");
        }
      }
      if (logo) {
        try {
          tenantPatch.logo_url = await remoteUploadImage(newSlug, dataUrlToFile(logo, "logo"), "brand");
        } catch {
          warn.push("logo (envie em Marca do app)");
        }
      }
      if (Object.keys(tenantPatch).length) await sb.from("tenants").update(tenantPatch).eq("id", t.id);
      const base = defaultIntegrations(t.id).payments;
      const key = normalizePixKey(pixKey);
      const { error: payErr } = await sb
        .from("integration_settings")
        .update({ payments: { ...base, pixKey: key ?? undefined, pixName: key ? pixName.trim() : undefined, gateways: { ...base.gateways, presencial: { ...base.gateways.presencial, enabled: cash || card } } } })
        .eq("tenant_id", t.id);
      if (payErr) warn.push("formas de recebimento (ajuste em Integrações)");
      if (modes.includes("delivery")) {
        const { error: zErr } = await sb.from("delivery_zones").insert({ tenant_id: t.id, bairro: city.trim(), fee: Math.max(0, parseMoney(fee) || 0), minutes: 40 });
        if (zErr) warn.push("taxa de entrega");
      }
      updateProgress(newSlug, (p) => ({ ...p, checklist: { ...p.checklist, pix: !!key || cash || card } }));
    }
    setLoading(false);
    if (warn.length) toast.warning(`Loja criada. Não deu para salvar: ${warn.join(", ")}.`);
    else toast.success("Loja criada! Agora faça o pedido de teste.");
    window.location.assign(new URL(`/painel/${newSlug}?bemvindo=1`, window.location.origin).href);
  };

  const ink = readableInk(pal.primary);

  return (
    <SaasSurface className="px-4 py-8">
      <main id="conteudo" className="mx-auto w-full max-w-3xl">
        <BrandLogo variant="compact" height={30} className="mb-6" />
        <h1 className="cz-heading text-3xl font-bold">Criar minha loja</h1>
        <p className="mt-1 text-cz-muted">Leva menos de 3 minutos. {TRIAL_DAYS} dias grátis, sem cartão. Tudo pode ser mudado depois.</p>
        {blocked && (
          <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-[#e8b4b4] bg-[#fbeaea] p-4 text-[#7a1f1f]">
            <p className="flex-1 text-sm font-semibold">{blocked} Para abrir outra loja, encerre uma das atuais ou peça mais lojas ao suporte.</p>
            <Link href="/painel" className="inline-flex min-h-11 items-center rounded-[10px] bg-cz-navy px-4 text-sm font-semibold text-white">
              Ir para minhas lojas
            </Link>
          </div>
        )}

        <ol className="mt-6 grid grid-cols-5 gap-1.5" aria-label="Etapas">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className="grid gap-1.5">
              <span className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-cz-gold" : "bg-cz-border")} aria-hidden />
              <span className={cn("text-xs", i === step ? "font-semibold" : "text-cz-muted")}>{s}</span>
            </li>
          ))}
        </ol>

        <section className="mt-6 rounded-[14px] border border-cz-border bg-cz-surface p-5 shadow-[0_8px_30px_rgb(11_31_64/0.06)] sm:p-6" aria-labelledby="passo">
          <h2 id="passo" className="text-lg font-bold">
            Passo {step + 1} de 5 · {STEPS[step]}
          </h2>
          <div className="mt-4 grid gap-5">
            {step === 0 && (
              <>
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Qual é o seu negócio?</legend>
                  <div role="radiogroup" aria-label="Tipo de negócio" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {NICHES.map((n) => {
                      const Icon = ICON[n.id];
                      const on = niche === n.id;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => pickNiche(n.id)}
                          className={cn(
                            "grid min-h-28 content-start gap-1.5 rounded-[12px] border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                            on ? "border-cz-gold bg-cz-surface-2 ring-2 ring-cz-gold" : "border-cz-border",
                          )}
                        >
                          <span className="flex items-center justify-between">
                            <Icon className="size-6" aria-hidden />
                            {on && <Check className="size-5 text-cz-success" aria-hidden />}
                          </span>
                          <span className="font-bold leading-tight">{n.label}</span>
                          <span className="text-xs text-cz-muted">{n.pitch}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome da loja" id="ob-nome" error={errors.name}>
                    <Input id="ob-nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Padaria Pão Dourado" autoComplete="organization" {...invalid("name", "ob-nome")} />
                  </Field>
                  <Field label="Endereço do cardápio" id="ob-slug" error={errors.slug} hint={finalSlug ? `Seu cardápio: ${finalSlug.replace(/-/g, "")}.${ROOT_DOMAIN}` : "Só letras, números e hífen"}>
                    <Input
                      id="ob-slug"
                      value={touched ? slug : finalSlug}
                      autoComplete="off"
                      onChange={(e) => {
                        setTouched(true);
                        setSlug(slugifyTyping(e.target.value));
                      }}
                      onBlur={() => touched && setSlug(slugify(slug))}
                      {...invalid("slug", "ob-slug")}
                      aria-describedby={errors.slug ? "ob-slug-error" : "ob-slug-hint"}
                    />
                  </Field>
                  <Field label="WhatsApp da loja" id="ob-wa" error={errors.whatsapp}>
                    <Input id="ob-wa" type="tel" inputMode="tel" autoComplete="tel-national" value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} placeholder="(19) 99999-0000" {...invalid("whatsapp", "ob-wa")} />
                  </Field>
                  <div className="grid grid-cols-[1fr_5rem] gap-3">
                    <Field label="Cidade" id="ob-city" error={errors.city}>
                      <Input id="ob-city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" {...invalid("city", "ob-city")} />
                    </Field>
                    <Field label="UF" id="ob-uf">
                      <Input id="ob-uf" value={uf} maxLength={2} onChange={(e) => setUf(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} autoComplete="address-level1" />
                    </Field>
                  </div>
                </div>

                <fieldset className="grid gap-2" aria-describedby={errors.modes ? "ob-modes-error" : undefined}>
                  <legend className="mb-1 text-sm font-semibold">Como você atende seus clientes?</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {SERVE.map((m) => (
                      <label key={m.id} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-[10px] border border-cz-border p-3 has-[:checked]:border-cz-gold has-[:checked]:bg-cz-surface-2">
                        <input id={`ob-mode-${m.id}`} type="checkbox" className="mt-0.5 size-5 accent-[#0b1f40]" aria-labelledby={`ob-mode-${m.id}-t`} aria-describedby={`ob-mode-${m.id}-d`} checked={modes.includes(m.id)} onChange={() => setModes(toggle(modes, m.id))} />
                        <span>
                          <span id={`ob-mode-${m.id}-t`} className="block text-sm font-semibold">{m.label}</span>
                          <span id={`ob-mode-${m.id}-d`} className="block text-xs text-cz-muted">{m.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <FieldError id="ob-modes" text={errors.modes} />
                  {!modes.includes("mesa") && <p className="text-xs text-cz-muted">Sem mesas: o painel esconde o mapa de mesas para ficar mais simples. Dá para ligar depois.</p>}
                  {modes.includes("delivery") && (
                    <div className="max-w-56">
                      <Field label="Taxa de entrega (R$)" id="ob-fee" error={errors.fee} hint={`Vale para ${city.trim() || "a sua cidade"}. Bairros com outra taxa você cria depois.`}>
                        <Input id="ob-fee" inputMode="decimal" autoComplete="off" value={fee} onChange={(e) => setFee(e.target.value.replace(/[^\d,.]/g, ""))} {...invalid("fee", "ob-fee")} />
                      </Field>
                    </div>
                  )}
                </fieldset>

                <details className="rounded-[10px] border border-cz-border p-3" open={errors.days || errors.hours ? true : undefined}>
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
                    Horário de funcionamento · {days.map((d) => DAYS[d]).join(", ") || "nenhum dia"}, {open} às {close}
                  </summary>
                  <div className="mt-3 grid gap-4">
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Dias de funcionamento">
                      {DAYS.map((d, i) => (
                        <button
                          key={d}
                          id={`ob-day-${i}`}
                          type="button"
                          aria-pressed={days.includes(i)}
                          onClick={() => setDays(toggle(days, i).sort())}
                          className={cn("min-h-11 min-w-12 rounded-[10px] border px-3 font-semibold", days.includes(i) ? "border-cz-navy bg-cz-navy text-white" : "border-cz-border")}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <FieldError id="ob-days" text={errors.days} />
                    <div className="grid max-w-sm grid-cols-2 gap-4">
                      <Field label="Abre às" id="ob-open">
                        <Input id="ob-open" type="time" autoComplete="off" value={open} onChange={(e) => setOpen(e.target.value)} />
                      </Field>
                      <Field label="Fecha às" id="ob-close" error={errors.hours}>
                        <Input id="ob-close" type="time" autoComplete="off" value={close} onChange={(e) => setClose(e.target.value)} {...invalid("hours", "ob-close")} />
                      </Field>
                    </div>
                  </div>
                </details>
              </>
            )}

            {step === 1 && (
              <div className="grid gap-5 md:grid-cols-[1fr_260px]">
                <div className="grid content-start gap-4">
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold">Cores (todas com contraste aprovado para leitura)</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {palettes.map((pl, i) => (
                        <button
                          key={pl.name}
                          type="button"
                          aria-pressed={palette === i}
                          onClick={() => setPalette(i)}
                          className={cn("grid min-h-16 justify-items-center gap-1 rounded-[10px] border p-2 text-sm transition", palette === i ? "border-cz-gold ring-2 ring-cz-gold" : "border-cz-border hover:bg-cz-surface-2")}
                        >
                          <span className="flex gap-1" aria-hidden>
                            <span className="size-6 rounded-full ring-1 ring-black/10" style={{ background: pl.primary }} />
                            <span className="size-6 rounded-full ring-1 ring-black/10" style={{ background: pl.accent }} />
                          </span>
                          {pl.name}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid gap-1.5">
                    <span className="text-sm font-semibold">Logo (opcional)</span>
                    <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[10px] border border-dashed border-cz-border p-3 focus-within:outline focus-within:outline-3 focus-within:outline-cz-info hover:bg-cz-surface-2">
                      {logo ? <img src={logo} alt="Logo escolhida" className="size-12 rounded-full object-cover" /> : <ImagePlus className="size-6 text-cz-muted" aria-hidden />}
                      <span className="text-sm">{logo ? "Trocar logo" : "Enviar logo (JPG, PNG ou WebP)"}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Enviar logo" onChange={(e) => onLogo(e.target.files?.[0])} />
                    </label>
                    <p className="text-xs text-cz-muted">Sem logo, o cardápio usa as iniciais da loja. Capa e fotos você troca depois.</p>
                  </div>
                </div>
                <PhonePreview name={name} label={preset.label} primary={pal.primary} ink={ink} logo={logo} products={preset.products.slice(0, 3)} />
              </div>
            )}

            {step === 2 && (
              <fieldset className="grid gap-3">
                <legend className="mb-1 text-sm text-cz-muted">Comece aprendendo com exemplos reais em vez de uma tela vazia. Você troca preços e fotos em segundos.</legend>
                <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[12px] border border-cz-border p-4 has-[:checked]:border-cz-gold has-[:checked]:bg-cz-surface-2">
                  <input type="radio" name="template" className="mt-1 size-5 accent-[#0b1f40]" aria-labelledby="ob-tpl-sim" checked={template} onChange={() => setTemplate(true)} />
                  <span className="grid gap-2">
                    <b id="ob-tpl-sim">Criar cardápio inicial de {preset.label} com 1 clique</b>
                    <span className="text-sm text-cz-muted">
                      {preset.categories.length} categorias e {preset.products.length} produtos com complementos prontos:
                    </span>
                    <ul className="grid gap-1.5 text-sm">
                      {preset.products.map((p) => (
                        <li key={p.name} className="flex items-center gap-2">
                          <img src={p.image.replace("w=900", "w=96")} alt="" loading="lazy" className="size-9 rounded-lg bg-cz-surface-2 object-cover" />
                          <span className="flex-1">
                            {p.name}
                            {p.groups?.length ? <span className="block text-xs text-cz-muted">{p.groups.map((g) => g.name).join(" · ")}</span> : null}
                          </span>
                          <span className="tabular-nums text-cz-muted">{p.priceLabel ?? money(p.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </span>
                </label>
                <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[12px] border border-cz-border p-4 has-[:checked]:border-cz-gold has-[:checked]:bg-cz-surface-2">
                  <input type="radio" name="template" className="mt-1 size-5 accent-[#0b1f40]" aria-labelledby="ob-tpl-nao" checked={!template} onChange={() => setTemplate(false)} />
                  <span>
                    <b id="ob-tpl-nao">Começar do zero</b>
                    <span className="block text-sm text-cz-muted">Cardápio vazio. Os exemplos continuam disponíveis em Cardápio, com 1 clique.</span>
                  </span>
                </label>
              </fieldset>
            )}

            {step === 3 && (
              <div className="grid gap-4">
                <p className="text-sm text-cz-muted">Sem configuração técnica: o dinheiro cai direto na sua conta. Depois, se quiser, dá para o sistema confirmar o Pix sozinho.</p>
                <fieldset className="grid gap-3 rounded-[12px] border border-cz-border p-4">
                  <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
                    <QrCode className="size-4" aria-hidden /> Pix na sua chave (opcional)
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Chave Pix" id="ob-pix" error={errors.pixKey} hint="Ex.: CPF 123.456.789-09, e-mail loja@email.com ou celular (19) 99999-0000">
                      <Input id="ob-pix" autoComplete="off" value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória" {...invalid("pixKey", "ob-pix")} />
                    </Field>
                    <Field label="Nome de quem recebe" id="ob-pixname" error={errors.pixName} hint="Como aparece no banco. Ex.: Padaria Pão Dourado Ltda">
                      <Input id="ob-pixname" autoComplete="organization" value={pixName} onChange={(e) => setPixName(e.target.value)} {...invalid("pixName", "ob-pixname")} />
                    </Field>
                  </div>
                </fieldset>
                <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-[12px] border border-cz-border p-4 has-[:checked]:border-cz-gold has-[:checked]:bg-cz-surface-2">
                  <input id="ob-cash" type="checkbox" className="mt-0.5 size-5 accent-[#0b1f40]" aria-labelledby="ob-cash-t" aria-describedby={errors.receive ? "ob-receive-error" : undefined} checked={cash} onChange={() => setCash(!cash)} />
                  <span>
                    <span id="ob-cash-t" className="flex items-center gap-2 font-semibold">
                      <Banknote className="size-4" aria-hidden /> Dinheiro
                    </span>
                    <span className="block text-sm text-cz-muted">O cliente informa “troco para quanto” e o caixa mostra o troco na hora.</span>
                  </span>
                </label>
                <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-[12px] border border-cz-border p-4 has-[:checked]:border-cz-gold has-[:checked]:bg-cz-surface-2">
                  <input type="checkbox" className="mt-0.5 size-5 accent-[#0b1f40]" aria-labelledby="ob-card-t" checked={card} onChange={() => setCard(!card)} />
                  <span>
                    <span id="ob-card-t" className="flex items-center gap-2 font-semibold">
                      <CreditCard className="size-4" aria-hidden /> Cartão na maquininha
                    </span>
                    <span className="block text-sm text-cz-muted">No balcão ou na entrega. Nenhum cadastro em operadora agora.</span>
                  </span>
                </label>
                <FieldError id="ob-receive" text={errors.receive} />
              </div>
            )}

            {step === 4 && (
              <div className="grid gap-4">
                <p>Logo depois de criar, o painel guia o seu <b>primeiro pedido de teste</b> em 3 toques, sem cliente de verdade:</p>
                <ol className="grid gap-2 sm:grid-cols-3">
                  {[
                    { icon: Store, t: "1. Pedido de teste", d: "Um toque cria um pedido do seu cardápio." },
                    { icon: ChefHat, t: "2. Tela da Cozinha (KDS)", d: "Ele chega com alerta. Toque em Começar e em Pronto." },
                    { icon: Banknote, t: "3. Frente de Caixa (PDV)", d: "Treine troco e divisão da conta sem medo de errar." },
                  ].map((s) => (
                    <li key={s.t} className="grid gap-1 rounded-[12px] border border-cz-border bg-cz-surface-2 p-3">
                      <s.icon className="size-5 text-cz-gold-text" aria-hidden />
                      <b className="text-sm">{s.t}</b>
                      <span className="text-xs text-cz-muted">{s.d}</span>
                    </li>
                  ))}
                </ol>
                <ul className="grid gap-1.5 text-sm">
                  {preset.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-cz-success" aria-hidden /> {h}
                    </li>
                  ))}
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-cz-success" aria-hidden /> A loja vai para o ar assim que você concluir.
                  </li>
                </ul>
              </div>
            )}

            <FieldError id="ob-submit" text={errors.submit} />
          </div>
        </section>

        <div className="mt-4 flex justify-between gap-2">
          <Button variant="ghost" onClick={() => (setErrors({}), setStep((s) => s - 1))} disabled={step === 0 || loading}>
            <ArrowLeft className="size-4" aria-hidden /> Voltar
          </Button>
          {step < 4 ? (
            <Button variant="brand" onClick={() => void next()} loading={checking}>
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

/** Mensagem de erro junto do campo, ligada por aria-describedby (`${id}-error`). */
function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-ui-error">
      {text}
    </p>
  );
}

/** Prévia do cardápio no celular, atualizada a cada escolha (cores, logo e produtos do nicho). */
function PhonePreview({ name, label, primary, ink, logo, products }: { name: string; label: string; primary: string; ink: string; logo: string; products: { name: string; price: number; priceLabel?: string; image: string }[] }) {
  const title = name.trim() || "Sua loja";
  return (
    <figure aria-label="Prévia do cardápio no celular" className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[28px] border-[6px] border-[#0b1f40] bg-white text-[#2b2b2b] shadow-xl">
      <div className="px-4 pb-4 pt-6" style={{ background: primary, color: ink }}>
        <div className="flex items-center gap-2">
          {logo ? (
            <img src={logo} alt="" className="size-10 rounded-full border-2 border-white object-cover" />
          ) : (
            <span className="grid size-10 place-items-center rounded-full border-2 border-white/70 text-sm font-bold">{title.slice(0, 2).toUpperCase()}</span>
          )}
          <div className="min-w-0">
            <p className="truncate font-bold">{title}</p>
            <p className="truncate text-xs opacity-90">{label} · peça pelo app</p>
          </div>
        </div>
      </div>
      <ul className="grid gap-2 p-3">
        {products.map((p) => (
          <li key={p.name} className="flex items-center gap-2 rounded-xl border border-black/10 p-2">
            <img src={p.image.replace("w=900", "w=96")} alt="" className="size-11 rounded-lg bg-[#ece6dd] object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">{p.name}</span>
              <span className="block text-xs tabular-nums text-[#555]">{p.priceLabel ?? money(p.price)}</span>
            </span>
            <span className="rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: primary, color: ink }} aria-hidden>
              +
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
