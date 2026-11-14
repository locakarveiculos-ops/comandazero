"use client";

/* eslint-disable @next/next/no-img-element -- QR gerado em data URL */
import { Check, Copy, Timer, Zap } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Modal } from "@/components/ui";
import { themeVars } from "@/components/tenant-theme";
import { GATEWAYS } from "@/lib/integrations/payments/factory";
import type { ChargeResult } from "@/lib/integrations/payments/types";
import type { Tenant } from "@/lib/types";
import { money } from "@/lib/utils";

/** Modal Pix: QR Code, copia e cola, contagem regressiva e simulação do webhook do gateway. */
export function PixModal({
  open,
  charge,
  amount,
  tenant,
  onPaid,
  onClose,
}: {
  open: boolean;
  charge: ChargeResult | null;
  amount: number;
  tenant: Tenant;
  onPaid: () => void;
  onClose: () => void;
}) {
  const [qr, setQr] = useState("");
  const [left, setLeft] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const code = charge?.pix?.copyPaste ?? "";

  useEffect(() => {
    if (!code) return;
    QRCode.toDataURL(code, { margin: 1, width: 520, errorCorrectionLevel: "M" }).then(setQr, () => setQr(""));
  }, [code]);

  useEffect(() => {
    if (!charge?.pix) return;
    const end = new Date(charge.pix.expiresAt).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [charge]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código Pix copiado");
    } catch {
      toast.error("Não consegui copiar. Selecione o código e copie manualmente.");
    }
  };

  const simulate = () => {
    setConfirming(true);
    // Simula o tempo de ida e volta do webhook do gateway.
    setTimeout(() => {
      setConfirming(false);
      onPaid();
    }, 1200);
  };

  const expired = left === 0 && !!charge;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()} title="Pague com Pix" description={`${money(amount)} · via ${charge ? GATEWAYS[charge.gateway].label : ""}`} themeStyle={themeVars(tenant.theme)}>
      <div className="grid gap-4 p-5 pt-3">
        <div className="mx-auto grid w-full max-w-64 place-items-center rounded-2xl border border-line bg-white p-3">
          {qr ? <img src={qr} alt="QR Code Pix para pagamento" className="aspect-square w-full" /> : <div className="aspect-square w-full animate-pulse rounded-xl bg-stone-200" />}
        </div>
        <p className={`flex items-center justify-center gap-2 text-sm font-semibold ${expired ? "text-red-700" : "text-ink"}`} aria-live="polite">
          <Timer className="size-4" aria-hidden />
          {expired ? "Código expirado. Feche e gere outro." : `Expira em ${mm}:${ss}`}
        </p>
        <div className="grid gap-2">
          <label htmlFor="pix-code" className="text-sm font-semibold text-ink">
            Pix copia e cola
          </label>
          <div className="flex gap-2">
            <input id="pix-code" readOnly value={code} onFocus={(e) => e.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 font-mono text-xs text-ink" />
            <Button onClick={copy} aria-label="Copiar código Pix">
              <Copy className="size-4" aria-hidden /> Copiar
            </Button>
          </div>
        </div>
        <ol className="grid gap-1 text-sm text-muted">
          <li>1. Abra o app do seu banco e escolha Pix › Copia e cola ou Ler QR.</li>
          <li>2. Confira o valor e o recebedor ({tenant.name}).</li>
          <li>3. A confirmação aparece aqui sozinha.</li>
        </ol>
        <div className="rounded-2xl border border-dashed border-line p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
            <Zap className="size-3.5" aria-hidden /> Ambiente de demonstração
          </p>
          <Button variant="outline" className="w-full text-ink" onClick={simulate} loading={confirming} disabled={expired}>
            <Check className="size-4" aria-hidden /> Simular confirmação do webhook
          </Button>
        </div>
      </div>
    </Modal>
  );
}
