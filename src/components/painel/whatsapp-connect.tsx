"use client";

/* eslint-disable @next/next/no-img-element -- QR vem como data URL do motor */
import { CheckCircle2, Loader2, LogOut, QrCode, RefreshCw, Smartphone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Field, Input, Switch } from "@/components/ui";
import { readChannelBlob, writeChannelBlob } from "@/lib/integrations/whatsapp/notify";
import type { Tenant } from "@/lib/types";
import { formatPhone } from "@/lib/utils";
import { useClientValue } from "@/lib/use-client";

type Status = { state: string; qr: string | null; pairingCode: string | null; phone: string | null; bot?: boolean; blob?: string; error?: string };

async function call(body: Record<string, unknown>): Promise<Status> {
  const r = await fetch("/api/whatsapp/channel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as Status;
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

const LABEL: Record<string, { text: string; tone: "green" | "amber" | "neutral" | "red" }> = {
  open: { text: "Conectado", tone: "green" },
  connecting: { text: "Aguardando leitura", tone: "amber" },
  disconnected: { text: "Desconectado", tone: "neutral" },
  closed: { text: "Desconectado", tone: "red" },
};

/** Conexão do WhatsApp da loja pelo motor Whaileys: QR na tela ou código de pareamento de 8 dígitos. */
/** included: plano (ou teste grátis) libera o WhatsApp — conecta sem código de ativação. */
export function WhatsappConnect({ tenant, included = false }: { tenant: Tenant; included?: boolean }) {
  const stored = useClientValue(() => readChannelBlob(tenant.slug), "");
  const [override, setBlob] = useState<string | null>(null);
  const blob = override ?? stored;
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState<string>("");
  const [activation, setActivation] = useState("");
  const [phone, setPhone] = useState("");
  const [serverError, setServerError] = useState("");
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(
    async (b = blob) => {
      if (!b) return setStatus({ state: "disconnected", qr: null, pairingCode: null, phone: null });
      try {
        const s = await call({ op: "status", slug: tenant.slug, blob: b });
        setStatus(s);
        setServerError("");
        return s;
      } catch (e) {
        setServerError((e as Error).message);
      }
    },
    [blob, tenant.slug],
  );

  useEffect(() => {
    let alive = true;
    const b = readChannelBlob(tenant.slug);
    if (!b) return;
    call({ op: "status", slug: tenant.slug, blob: b }).then(
      (s) => alive && setStatus(s),
      (e) => alive && setServerError((e as Error).message),
    );
    return () => {
      alive = false;
    };
  }, [tenant.slug]);

  // Enquanto aguarda a leitura, consulta a cada 3 s (o QR vence em ~20 s e o motor gera outro).
  useEffect(() => {
    if (status?.state !== "connecting") return;
    poll.current = setInterval(() => void refresh(), 3000);
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [status?.state, refresh]);

  useEffect(() => {
    if (status?.state === "open" && status.phone) toast.success(`WhatsApp ${formatPhone(status.phone)} conectado`, { id: "wa-open" });
  }, [status?.state, status?.phone]);

  const connect = async (withPhone: boolean) => {
    setLoading(withPhone ? "phone" : "qr");
    try {
      const s = await call({ op: "connect", slug: tenant.slug, blob: blob || undefined, activation: blob ? undefined : activation, phone: withPhone ? phone : undefined });
      if (s.blob && s.blob !== blob) {
        writeChannelBlob(tenant.slug, s.blob);
        setBlob(s.blob);
      }
      setStatus(s);
      setServerError("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading("");
    }
  };

  const logout = async () => {
    if (!confirm("Desconectar o WhatsApp da loja? Os avisos automáticos param até conectar de novo.")) return;
    setLoading("logout");
    try {
      setStatus(await call({ op: "logout", slug: tenant.slug, blob }));
      toast.success("WhatsApp desconectado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading("");
    }
  };

  const toggleBot = async (enabled: boolean) => {
    try {
      const s = await call({ op: "bot", slug: tenant.slug, blob, enabled });
      if (s.blob) {
        writeChannelBlob(tenant.slug, s.blob);
        setBlob(s.blob);
      }
      setStatus((cur) => (cur ? { ...cur, bot: enabled } : cur));
      toast.success(enabled ? "Robô de atendimento ligado" : "Robô desligado: só avisos de pedido");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const st = LABEL[status?.state ?? "disconnected"] ?? LABEL.disconnected;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={st.tone}>{st.text}</Badge>
          {status?.phone && <span className="text-sm font-semibold">{formatPhone(status.phone)}</span>}
          <span className="font-mono text-xs text-cz-muted">cpw-{tenant.slug}</span>
        </div>
        {blob && (
          <Button size="sm" variant="ghost" onClick={() => refresh()} aria-label="Atualizar status">
            <RefreshCw className="size-4" aria-hidden /> Atualizar
          </Button>
        )}
      </div>

      {serverError && <p className="rounded-xl bg-cz-warning/10 p-3 text-sm text-cz-warning">{serverError}</p>}

      {status?.state === "open" ? (
        <div className="grid gap-3">
          <p className="flex items-center gap-2 rounded-xl bg-cz-success/10 p-3 text-sm text-cz-success">
            <CheckCircle2 className="size-5" aria-hidden /> Pronto! Pedidos novos e mudanças de status disparam mensagens com botões para o cliente.
          </p>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-cz-border px-3 text-sm">
            <span>
              <b>Robô de atendimento</b>
              <span className="block text-xs text-cz-muted">Responde “oi” com menu em lista: cardápio por categoria, link do app, endereço e atendente.</span>
            </span>
            <Switch checked={status.bot !== false} onCheckedChange={toggleBot} label="Robô de atendimento" />
          </label>
          <Button variant="ghost" className="justify-self-start text-cz-error" onClick={logout} loading={loading === "logout"}>
            <LogOut className="size-4" aria-hidden /> Desconectar número
          </Button>
        </div>
      ) : status?.state === "connecting" && (status.qr || status.pairingCode) ? (
        <div className="grid items-center gap-4 sm:grid-cols-[220px_1fr]">
          {status.qr ? (
            <img src={status.qr} alt="QR Code para conectar o WhatsApp" className="w-full max-w-56 rounded-xl border border-cz-border bg-cz-surface p-2" />
          ) : (
            <div className="rounded-2xl bg-cz-navy p-5 text-center text-white">
              <p className="text-xs uppercase tracking-widest opacity-75">Código de pareamento</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em]">{status.pairingCode}</p>
            </div>
          )}
          <ol className="grid gap-1.5 text-sm">
            <li>1. No celular da loja, abra o WhatsApp.</li>
            <li>2. Toque em ⋮ › <b>Aparelhos conectados</b> › <b>Conectar aparelho</b>.</li>
            <li>3. {status.qr ? "Aponte a câmera para o QR ao lado." : "Escolha “Conectar com número de telefone” e digite o código."}</li>
            <li className="flex items-center gap-2 text-cz-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Aguardando… o QR se renova sozinho.
            </li>
          </ol>
        </div>
      ) : (
        <div className="grid gap-4">
          {!blob && included && <p className="rounded-xl bg-cz-success/10 p-3 text-sm">Incluído no seu plano (e liberado no teste grátis). Conecte o número da loja abaixo.</p>}
          {!blob && !included && (
            <Field label="Código de ativação" id="wa-act" hint="WhatsApp faz parte do plano Profissional. Com o código da plataforma, o canal é liberado manualmente.">
              <Input id="wa-act" type="password" autoComplete="off" value={activation} onChange={(e) => setActivation(e.target.value)} />
            </Field>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" onClick={() => connect(false)} loading={loading === "qr"} disabled={!blob && !activation && !included}>
              <QrCode className="size-4" aria-hidden /> Conectar com QR Code
            </Button>
          </div>
          <div className="grid gap-2 rounded-2xl border border-cz-border p-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Ou receba um código de 8 dígitos" id="wa-phone" hint="Número do WhatsApp da loja, com DDD.">
              <Input id="wa-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder={formatPhone(tenant.whatsapp)} />
            </Field>
            <Button variant="secondary" onClick={() => connect(true)} loading={loading === "phone"} disabled={(!blob && !activation && !included) || phone.replace(/\D/g, "").length < 10}>
              <Smartphone className="size-4" aria-hidden /> Gerar código
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
