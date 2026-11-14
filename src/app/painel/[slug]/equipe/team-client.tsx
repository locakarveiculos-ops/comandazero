"use client";

import { Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";

export type Member = { user_id: string; email: string; name: string; role: Role | "owner"; created_at: string; last_sign_in_at: string | null; invited: boolean };
type Role = "manager" | "cashier" | "waiter" | "kitchen";

/** O que cada papel enxerga. Mesmo texto do artigo de treinamento "Equipe". */
const ROLES: { id: Role; label: string; can: string }[] = [
  { id: "manager", label: "Gerente", can: "Tudo, menos equipe e assinatura" },
  { id: "cashier", label: "Caixa", can: "Pedidos, PDV, mesas e KDS" },
  { id: "waiter", label: "Garçom", can: "Pedidos, mesas e KDS" },
  { id: "kitchen", label: "Cozinha", can: "Pedidos e KDS" },
];
const label = (r: Member["role"]) => (r === "owner" ? "Dono" : (ROLES.find((x) => x.id === r)?.label ?? r));

export function TeamClient({ slug, members }: { slug: string; members: Member[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("cashier");
  const [busy, setBusy] = useState<string | null>(null);

  const send = async (method: "POST" | "PATCH" | "DELETE", body: object, key: string, ok: string) => {
    setBusy(key);
    const r = await fetch("/api/equipe", { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, ...body }) });
    const data = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return toast.error(data.error ?? "Não foi possível salvar."), false;
    toast.success(method === "POST" && data.invited ? "Convite enviado por e-mail." : ok);
    router.refresh();
    return true;
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return toast.error("Informe um e-mail válido.");
    if (await send("POST", { email: email.trim(), role }, "novo", "Acesso liberado.")) setEmail("");
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="cz-heading text-2xl font-bold">Equipe</h1>
        <p className="text-sm text-cz-muted">Cada pessoa entra com o próprio e-mail e vê só o que o papel dela permite.</p>
      </div>

      <Card data-tour="equipe-convite">
        <h2 className="font-bold">Adicionar pessoa</h2>
        <form onSubmit={invite} className="mt-4 grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end" noValidate>
          <Field label="E-mail" id="eq-email">
            <Input id="eq-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="caixa@minhaloja.com.br" />
          </Field>
          <Field label="Papel" id="eq-role">
            <Select id="eq-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="brand" loading={busy === "novo"}>
            <UserPlus className="size-4" aria-hidden /> Adicionar
          </Button>
        </form>
        <p className="mt-3 text-sm text-cz-muted">
          {ROLES.find((r) => r.id === role)?.label}: {ROLES.find((r) => r.id === role)?.can}. Quem ainda não tem conta recebe um e-mail para criar a senha.
        </p>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="p-4 text-left font-bold">Quem tem acesso ({members.length})</caption>
          <thead className="border-y border-cz-border text-xs uppercase tracking-wider text-cz-muted">
            <tr>
              <th className="p-4">Pessoa</th>
              <th className="p-4">Papel</th>
              <th className="p-4">Último acesso</th>
              <th className="p-4">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cz-border">
            {members.map((m) => (
              <tr key={m.user_id}>
                <td className="p-4">
                  <p className="font-semibold">{m.name || m.email}</p>
                  {m.name && <p className="text-xs text-cz-muted">{m.email}</p>}
                </td>
                <td className="p-4">
                  {m.role === "owner" ? (
                    <Badge tone="blue">Dono</Badge>
                  ) : (
                    <Select aria-label={`Papel de ${m.email}`} value={m.role} disabled={busy === m.user_id} onChange={(e) => send("PATCH", { userId: m.user_id, role: e.target.value }, m.user_id, "Papel atualizado.")} className="min-w-32">
                      {ROLES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </td>
                <td className="p-4 text-cz-muted">{m.invited ? <Badge tone="amber">Convite pendente</Badge> : m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                <td className="p-4 text-right">
                  {m.role !== "owner" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remover ${m.email}`}
                      loading={busy === m.user_id}
                      onClick={() => confirm(`Remover o acesso de ${m.email}?`) && send("DELETE", { userId: m.user_id }, m.user_id, `Acesso de ${label(m.role)} removido.`)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
