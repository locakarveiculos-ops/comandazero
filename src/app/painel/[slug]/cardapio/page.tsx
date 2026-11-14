"use client";

/* eslint-disable @next/next/no-img-element -- fotos podem vir de upload */
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useStoreTenant } from "@/components/loja/use-store-tenant";
import { Badge, Button, Card, Field, Input, Modal, Select, Switch, Textarea } from "@/components/ui";
import { fileToDataUrl } from "@/lib/image";
import { addCategory, deleteProduct, saveProduct } from "@/lib/repositories";
import { isRemote, setProductAvailable, useStoreMenu } from "@/lib/repositories/engine";
import { remoteSaveProduct, remoteUploadImage } from "@/lib/repositories/remote";
import type { OptionGroup, Product, Tenant } from "@/lib/types";
import { cn, money, uid } from "@/lib/utils";

export default function CardapioPage() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant } = useStoreTenant(slug);
  const { categories, products } = useStoreMenu(tenant);
  const [editing, setEditing] = useState<Product | null>(null);
  const [newCat, setNewCat] = useState("");
  const [filter, setFilter] = useState("all");

  if (!tenant) return null;
  const list = products.filter((p) => filter === "all" || (filter === "off" ? !p.available : p.categoryId === filter));
  const paused = products.filter((p) => !p.available).length;

  const blank = (): Product => ({
    id: uid("p_"),
    tenantId: tenant.id,
    categoryId: categories[0]?.id ?? "",
    code: String(100 + products.length + 1),
    name: "",
    description: "",
    price: 0,
    image: products[0]?.image ?? "",
    available: true,
    optionGroups: [],
    quickNotes: [],
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="cz-heading text-2xl font-bold">Cardápio & estoque rápido</h1>
          <p className="text-sm text-cz-muted">Pausar um item some do cardápio na hora, em todos os aparelhos. {paused > 0 && <b>{paused} pausado(s).</b>}</p>
        </div>
        <Button variant="brand" onClick={() => setEditing(blank())} data-tour="cardapio-novo">
          <Plus className="size-4" aria-hidden /> Novo produto
        </Button>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="no-scrollbar flex min-w-0 max-w-full gap-2 overflow-x-auto" role="tablist" aria-label="Filtrar" data-tour="cardapio-filtros">
          {[{ id: "all", name: "Todos" }, ...categories, { id: "off", name: "Pausados" }].map((c) => (
            <button key={c.id} role="tab" aria-selected={filter === c.id} onClick={() => setFilter(c.id)} className={cn("min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold", filter === c.id ? "bg-brand text-brand-ink" : "bg-cz-surface ring-1 ring-cz-border")}>
              {c.name}
            </button>
          ))}
        </div>
        <form
          className="flex w-full gap-2 sm:ml-auto sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCat.trim()) return;
            addCategory(tenant.id, newCat.trim());
            toast.success(`Categoria ${newCat} criada`);
            setNewCat("");
          }}
        >
          <Input aria-label="Nova categoria" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nova categoria" className="min-w-0 flex-1 sm:w-44 sm:flex-none" />
          <Button variant="secondary" type="submit">
            Criar
          </Button>
        </form>
      </div>

      <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3" data-tour="cardapio-lista">
        {list.map((p) => (
          <li key={p.id}>
            <Card className={cn("flex gap-3 p-3", !p.available && "bg-cz-surface-2")}>
              <img src={p.image} alt="" className={cn("size-20 shrink-0 rounded-xl object-cover", !p.available && "grayscale")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-tight">
                    <span className="mr-1.5 font-mono text-xs text-cz-muted">{p.code}</span>
                    {p.name}
                  </p>
                  <Switch
                    checked={p.available}
                    label={`${p.available ? "Pausar" : "Reativar"} ${p.name}`}
                    onCheckedChange={() => {
                      void setProductAvailable(tenant, p.id, !p.available).catch((e: Error) => toast.error(e.message));
                      toast(p.available ? `“${p.name}” pausado: esgotou por hoje` : `“${p.name}” voltou ao cardápio`);
                    }}
                  />
                </div>
                <p className="text-sm tabular-nums text-cz-muted">{p.priceLabel ?? money(p.price)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {!p.available && <Badge tone="red">Esgotado</Badge>}
                  {p.cake && <Badge tone="amber">Encomenda</Badge>}
                  {p.optionGroups.length > 0 && <Badge>{p.optionGroups.length} grupo(s) de opções</Badge>}
                  <button type="button" onClick={() => setEditing(p)} className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold hover:bg-cz-surface-2">
                    <Pencil className="size-3.5" aria-hidden /> Editar
                  </button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <ProductEditor product={editing} categories={categories} tenant={tenant} onClose={() => setEditing(null)} />
    </div>
  );
}

function ProductEditor({ product, categories, tenant, onClose }: { product: Product | null; categories: { id: string; name: string }[]; tenant: Tenant; onClose: () => void }) {
  return (
    <Modal open={!!product} onOpenChange={(v) => !v && onClose()} title={product?.name ? `Editar ${product.name}` : "Novo produto"} side="right">
      {product && <EditorForm key={product.id} initial={product} categories={categories} tenant={tenant} onClose={onClose} />}
    </Modal>
  );
}

function EditorForm({ initial, categories, tenant, onClose }: { initial: Product; categories: { id: string; name: string }[]; tenant: Tenant; onClose: () => void }) {
  const remote = isRemote(tenant);
  const [p, setP] = useState<Product>(initial);
  const [price, setPrice] = useState(initial.price.toFixed(2).replace(".", ","));
  const [uploading, setUploading] = useState(false);
  const isNew = !initial.name;
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));
  const setGroup = (i: number, g: Partial<OptionGroup>) => set("optionGroups", p.optionGroups.map((x, j) => (j === i ? { ...x, ...g } : x)));

  const onImage = async (f?: File) => {
    if (!f) return;
    setUploading(true);
    try {
      // Loja real: Storage (servidor valida tipo e tamanho). Demo: imagem reduzida no navegador.
      set("image", remote ? await remoteUploadImage(tenant.slug, f) : await fileToDataUrl(f));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    const value = Number(price.replace(/\./g, "").replace(",", "."));
    if (!p.name.trim()) return toast.error("Informe o nome");
    if (!(value >= 0)) return toast.error("Preço inválido");
    for (const g of p.optionGroups) {
      if (!g.name.trim() || !g.choices.length) return toast.error("Cada grupo precisa de nome e ao menos uma opção");
      if (g.min > g.max) return toast.error(`Em “${g.name}”, o mínimo não pode passar do máximo`);
    }
    const product = { ...p, price: value, name: p.name.trim(), cake: p.cake ? { ...p.cake, pricePerKg: value } : undefined };
    const done = () => {
      toast.success(isNew ? "Produto criado" : "Alterações salvas");
      onClose();
    };
    if (remote) return void remoteSaveProduct(tenant.id, product).then(done, (e: Error) => toast.error(e.message));
    saveProduct(product);
    done();
  };

  return (
    <div className="grid gap-4 p-5">
      <div className="grid gap-2">
        <span className="text-sm font-semibold">Foto</span>
        <label className="group relative block cursor-pointer overflow-hidden rounded-2xl bg-cz-surface-2 focus-within:outline focus-within:outline-3 focus-within:outline-cz-info">
          {p.image ? <img src={p.image} alt="" className="aspect-video w-full object-cover" /> : <div className="aspect-video" />}
          <span className="absolute inset-0 grid place-items-center bg-black/40 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            <span className="flex items-center gap-2">
              <ImagePlus className="size-5" aria-hidden /> {uploading ? "Processando…" : "Trocar foto"}
            </span>
          </span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onImage(e.target.files?.[0])} aria-label="Enviar foto do produto" />
        </label>
        <Input aria-label="URL da foto" value={p.image.startsWith("data:") ? "" : p.image} onChange={(e) => set("image", e.target.value)} placeholder="Ou cole o link de uma imagem" />
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Field label="Nome" id="pn">
          <Input id="pn" value={p.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Código" id="pc" hint="Usado no PDV">
          <Input id="pc" value={p.code} onChange={(e) => set("code", e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" />
        </Field>
      </div>
      <Field label="Descrição" id="pd">
        <Textarea id="pd" value={p.description} onChange={(e) => set("description", e.target.value)} maxLength={180} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={p.cake ? "Preço por kg" : "Preço"} id="pp">
          <Input id="pp" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d,.]/g, ""))} />
        </Field>
        <Field label="Categoria" id="pcat">
          <Select id="pcat" value={p.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Selo (opcional)" id="pb" hint="Ex.: Mais pedido, Novidade, Sem glúten">
        <Input id="pb" value={p.badge ?? ""} onChange={(e) => set("badge", e.target.value || undefined)} />
      </Field>
      <Field label="Observações rápidas" id="pq" hint="Separe por vírgula. Viram botões no pedido.">
        <Input id="pq" value={p.quickNotes.join(", ")} onChange={(e) => set("quickNotes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
      </Field>
      <label className="flex min-h-11 items-center justify-between rounded-xl bg-cz-surface-2 px-3 text-sm font-semibold">
        Destaque na vitrine
        <Switch checked={!!p.featured} onCheckedChange={(v) => set("featured", v)} label="Destaque na vitrine" />
      </label>

      <section className="grid gap-3" aria-labelledby="grupos">
        <div className="flex items-center justify-between">
          <h3 id="grupos" className="font-bold">
            Grupos de complementos
          </h3>
          <Button size="sm" variant="secondary" onClick={() => set("optionGroups", [...p.optionGroups, { id: uid("g_"), name: "", min: 0, max: 1, choices: [] }])}>
            <Plus className="size-4" aria-hidden /> Grupo
          </Button>
        </div>
        {p.optionGroups.map((g, i) => (
          <div key={g.id} className="grid gap-3 rounded-2xl border border-cz-border p-3">
            <div className="flex gap-2">
              <Input aria-label="Nome do grupo" value={g.name} onChange={(e) => setGroup(i, { name: e.target.value })} placeholder="Ex.: Sabor, Adicionais" />
              <button type="button" aria-label={`Remover grupo ${g.name}`} onClick={() => set("optionGroups", p.optionGroups.filter((_, j) => j !== i))} className="grid size-11 shrink-0 place-items-center rounded-full text-cz-error hover:bg-cz-error/10">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs font-semibold">
                Mínimo
                <Input type="number" min={0} max={10} value={g.min} onChange={(e) => setGroup(i, { min: Math.max(0, Number(e.target.value)) })} />
              </label>
              <label className="grid gap-1 text-xs font-semibold">
                Máximo
                <Input type="number" min={1} max={10} value={g.max} onChange={(e) => setGroup(i, { max: Math.max(1, Number(e.target.value)) })} />
              </label>
            </div>
            <ul className="grid gap-2">
              {g.choices.map((c, k) => (
                <li key={c.id} className="grid grid-cols-[1fr_96px_44px] gap-2">
                  <Input aria-label="Nome da opção" value={c.name} onChange={(e) => setGroup(i, { choices: g.choices.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)) })} />
                  <Input aria-label={`Preço de ${c.name}`} inputMode="decimal" value={String(c.price).replace(".", ",")} onChange={(e) => setGroup(i, { choices: g.choices.map((x, j) => (j === k ? { ...x, price: Number(e.target.value.replace(",", ".")) || 0 } : x)) })} />
                  <button type="button" aria-label={`Remover ${c.name}`} onClick={() => setGroup(i, { choices: g.choices.filter((_, j) => j !== k) })} className="grid size-11 place-items-center rounded-full hover:bg-cz-surface-2">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" onClick={() => setGroup(i, { choices: [...g.choices, { id: uid("o_"), name: "", price: 0 }] })}>
              <Plus className="size-4" aria-hidden /> Opção
            </Button>
          </div>
        ))}
      </section>

      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-cz-border bg-cz-surface p-4">
        {!isNew && (
          <Button
            variant="ghost"
            className="text-cz-error"
            onClick={() => {
              if (!confirm(`Excluir “${p.name}”? Esta ação não pode ser desfeita.`)) return;
              deleteProduct(p.id);
              onClose();
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Excluir
          </Button>
        )}
        <Button variant="brand" className="flex-1" onClick={save}>
          Salvar
        </Button>
      </div>
    </div>
  );
}
