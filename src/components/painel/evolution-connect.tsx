"use client";

/* eslint-disable @next/next/no-img-element -- QR vem como data URL do servidor */
import { CheckCircle2, Loader2, LogOut, QrCode, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Button } from "@/components/ui";
import type { EvolutionStatus } from "@/lib/integrations/whatsapp/evolution";
import type { Tenant } from "@/lib/types";
import { formatPhone } from "@/lib/utils";

async function call(slug: string, op: "status" | "connect" | "logout"): Promise<EvolutionStatus> {
  const r = await fetch("/api/whatsapp/evolution", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, slug }) });
  const d = (await r.json().catch(() => ({}))) as EvolutionStatus & { error?: string };
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

const LABEL: Record<EvolutionStatus["state"], { text: string; tone: "green" | "amber" | "neutral" }> = {
  open: { text: "Conectado", tone: "green" },
  connecting: { text: "Aguardando leitura", tone: "amber" },
  disconnected: { text: "Desconectado", tone: "neutral" },
};

/** Conexão do WhatsApp pelo servidor próprio (Evolution): QR na tela, atualiza sozinho até conectar. */
export function EvolutionConnect({ tenant }: { tenant: Tenant }) {
  const [status, setStatus] = useState<EvolutionStatus | null>(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const demo = tenant.isDemo !== false;

  const refresh = useCallback(async () => {
    try {
      setStatus(await call(tenant.slug, "status"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [tenant.slug]);

  useEffect(() => {
    if (demo) return;
    let alive = true;
    call(tenant.slug, "status").then(
      (s) => alive && setStatus(s),
      (e) => alive && setError((e as Error).message),
    );
    return () => {
      alive = false;
    };
  }, [tenant.slug, demo]);

  // Aguardando a leitura: consulta a cada 3 s; ao conectar, o QR some e aparece "Conectado".
  // O QR da Evolution vence em ~40 s: a cada 30 s pede um novo.
  useEffect(() => {
    if (status?.state !== "connecting") return;
    const t = setInterval(() => void refresh(), 3000);
    const renew = setInterval(() => void call(tenant.slug, "connect").then(setStatus, () => undefined), 30000);
    return () => {
      clearInterval(t);
      clearInterval(renew);
    };
  }, [status?.state, refresh, tenant.slug]);

  useEffect(() => {
    if (status?.state === "open") toast.success(status.phone ? `WhatsApp ${formatPhone(status.phone)} conectado` : "WhatsApp conectado", { id: "evo-open" });
  }, [status?.state, status?.phone]);

  const run = async (op: "connect" | "logout") => {
    if (op === "logout" && !confirm("Desconectar o WhatsApp? Os avisos automáticos param até conectar de novo.")) return;
    setLoading(op);
    try {
      setStatus(await call(tenant.slug, op));
      setError("");
      if (op === "logout") toast.success("WhatsApp desconectado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading("");
    }
  };

  if (demo) return <p className="rounded-xl bg-cz-surface-2 p-3 text-sm text-cz-muted">Na loja de demonstração o WhatsApp não é conectado de verdade. Crie a sua loja para conectar o número.</p>;

  const st = LABEL[status?.state ?? "disconnected"];
  return (
    <div className="grid gap-4" data-testid="evolution-connect">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={st.tone}>{status ? st.text : "Verificando…"}</Badge>
          {status?.phone && <span className="text-sm font-semibold">{formatPhone(status.phone)}</span>}
        </div>
        <Button size="sm" variant="ghost" onClick={() => void refresh()} aria-label="Atualizar status">
          <RefreshCw className="size-4" aria-hidden /> Atualizar
        </Button>
      </div>

      {error && <p className="rounded-xl bg-cz-warning/10 p-3 text-sm text-cz-warning">{error}</p>}

      {status?.state === "open" ? (
        <div className="grid gap-3">
          <p className="flex items-center gap-2 rounded-xl bg-cz-success/10 p-3 text-sm text-cz-success">
            <CheckCircle2 className="size-5" aria-hidden /> Pronto! O WhatsApp da loja está conectado.
          </p>
          <Button variant="ghost" className="justify-self-start text-cz-error" onClick={() => void run("logout")} loading={loading === "logout"}>
            <LogOut className="size-4" aria-hidden /> Desconectar número
          </Button>
        </div>
      ) : status?.state === "connecting" && status.qr ? (
        <div className="grid items-center gap-4 sm:grid-cols-[220px_1fr]">
          <img src={status.qr} alt="QR Code para conectar o WhatsApp" className="w-full max-w-56 rounded-xl border border-cz-border bg-white p-2" />
          <ol className="grid gap-1.5 text-sm">
            <li>1. No celular da loja, abra o WhatsApp.</li>
            <li>
              2. Toque em ⋮ › <b>Aparelhos conectados</b> › <b>Conectar aparelho</b>.
            </li>
            <li>3. Aponte a câmera para o QR ao lado.</li>
            <li className="flex items-center gap-2 text-cz-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Aguardando… o QR se renova sozinho.
            </li>
          </ol>
        </div>
      ) : (
        <Button variant="brand" className="justify-self-start" onClick={() => void run("connect")} loading={loading === "connect"} disabled={!status && !error}>
          <QrCode className="size-4" aria-hidden /> Gerar QR Code para conectar
        </Button>
      )}
    </div>
  );
}
