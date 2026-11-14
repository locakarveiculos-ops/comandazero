"use client";

import { Download, Share, SquarePlus } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui";
import { themeVars } from "@/components/tenant-theme";
import type { Tenant } from "@/lib/types";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Botão "Instalar app da loja": prompt nativo no Android/desktop e passo a passo no iOS. */
export function InstallApp({ tenant }: { tenant: Tenant }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const standalone = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(display-mode: standalone)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(display-mode: standalone)").matches,
    () => false,
  );
  const [justInstalled, setInstalled] = useState(false);
  const installed = standalone || justInstalled;
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    // Manifest da loja: definido pelo servidor (metadata de /loja/[slug]); não manipular <link> geridos pelo React.
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevTheme = theme?.content;
    if (theme) theme.content = tenant.theme.primary;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      toast.success(`App da ${tenant.name} instalado!`);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      if (theme && prevTheme) theme.content = prevTheme;
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [tenant.slug, tenant.name, tenant.theme.primary, tenant.theme.paper]);

  if (installed) return null;

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setDeferred(null);
      return;
    }
    setIosHelp(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-ink shadow-sm hover:opacity-90"
      >
        <Download className="size-4" aria-hidden />
        Instalar app
      </button>
      <Modal open={iosHelp} onOpenChange={setIosHelp} title={`Instale o app da ${tenant.name}`} description="Leva 10 segundos e fica na tela inicial do celular." themeStyle={themeVars(tenant.theme)}>
        <ol className="grid gap-4 p-5 text-sm">
          <li className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ui-surface-2 font-bold">1</span>
            <span>
              No iPhone, toque em <Share className="inline size-4" aria-label="Compartilhar" /> <b>Compartilhar</b> na barra do Safari.
              <br />
              No Android, abra o menu <b>⋮</b> do Chrome.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ui-surface-2 font-bold">2</span>
            <span>
              Escolha <SquarePlus className="inline size-4" aria-hidden /> <b>Adicionar à Tela de Início</b> (ou <b>Instalar app</b>).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ui-surface-2 font-bold">3</span>
            <span>
              Pronto! O ícone da <b>{tenant.name}</b> abre o cardápio direto, como um app.
            </span>
          </li>
        </ol>
      </Modal>
    </>
  );
}
