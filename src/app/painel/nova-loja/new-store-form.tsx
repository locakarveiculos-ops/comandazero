"use client";

import { Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BrandLogo, SaasSurface } from "@/components/brand-switcher";
import { Button, Field, Input, Select } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { formatPhone, slugify } from "@/lib/utils";

const ERRORS: Record<string, string> = {
  SLUG_INVALIDO: "Endereço inválido. Use letras, números e hífen.",
  SLUG_EM_USO: "Esse endereço já está em uso. Escolha outro.",
  LIMITE_LOJAS: "Limite de 5 lojas por conta. Fale com o suporte.",
  SEM_LOGIN: "Entre na sua conta novamente.",
};

export function NewStoreForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [category, setCategory] = useState("Cafeteria");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const finalSlug = touched ? slug : slugify(name);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error("Informe o nome da loja");
    setLoading(true);
    const { data, error } = await getSupabase()!.rpc("create_my_tenant", { p_name: name.trim(), p_slug: finalSlug, p_category: category, p_whatsapp: whatsapp, p_city: city });
    setLoading(false);
    if (error) return toast.error(ERRORS[error.message.split(":")[0]] ?? error.message);
    toast.success("Loja criada! Revise o cardápio modelo.");
    window.location.assign(new URL(`/painel/${data as string}`, window.location.origin).href);
  };

  return (
    <SaasSurface className="grid place-items-center p-4">
      <main id="conteudo" className="w-full max-w-lg py-10">
        <BrandLogo variant="compact" height={30} className="mb-8" />
        <h1 className="cz-heading text-3xl font-bold">Criar minha loja</h1>
        <p className="mt-1 text-cz-muted">A loja começa com um cardápio modelo que você edita depois. Leva 1 minuto.</p>
        <form onSubmit={submit} className="mt-8 grid gap-4" noValidate>
          <Field label="Nome da loja" id="nl-nome">
            <Input id="nl-nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Padaria Pão Dourado" autoComplete="organization" />
          </Field>
          <Field label="Endereço do cardápio" id="nl-slug" hint={finalSlug ? `comandazero.vercel.app/loja/${finalSlug}` : undefined}>
            <Input id="nl-slug" value={finalSlug} onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)); }} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo" id="nl-cat">
              <Select id="nl-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {["Cafeteria", "Padaria", "Confeitaria", "Lanchonete", "Hamburgueria", "Açaí", "Restaurante"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Cidade" id="nl-city">
              <Input id="nl-city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
            </Field>
          </div>
          <Field label="WhatsApp da loja" id="nl-wa" hint="Usado no botão de contato do cardápio.">
            <Input id="nl-wa" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} placeholder="(19) 99999-0000" />
          </Field>
          <Button type="submit" variant="brand" size="lg" loading={loading}>
            <Store className="size-4" aria-hidden /> Criar loja
          </Button>
        </form>
      </main>
    </SaasSurface>
  );
}
