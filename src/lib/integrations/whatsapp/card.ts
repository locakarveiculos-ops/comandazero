// Formato das mensagens interativas (puro: usado no servidor e no simulador do painel).

export type Card = {
  text: string;
  buttons?: { id: string; title: string }[];
  sections?: { title: string; rows: { id: string; title: string; description?: string }[] }[];
  buttonText?: string;
};

export type Incoming =
  | { kind: "action"; id: string }
  | { kind: "text"; text: string }
  | { kind: "location"; lat: number; lng: number }
  | { kind: "media"; type: "audio" | "image" | "document" }
  | { kind: "ignored" };

type Proto = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const unwrap = (m: Proto) =>
  m?.ephemeralMessage?.message ?? m?.viewOnceMessage?.message ?? m?.viewOnceMessageV2?.message ?? m?.documentWithCaptionMessage?.message ?? m;

function nativeFlowId(params: unknown) {
  if (typeof params !== "string") return undefined;
  try {
    return (JSON.parse(params) as { id?: string }).id;
  } catch {
    return undefined;
  }
}

/**
 * Proto do WhatsApp para evento. Clique em botão/lista vira o id; "1", "2"... digitados viram a opção numerada
 * do último card enviado (reserva para aparelhos que não mostram botões).
 */
export function parseIncoming(raw: unknown, numbered: string[] = []): Incoming {
  if (!raw || typeof raw !== "object") return { kind: "ignored" };
  const m = unwrap(raw as Proto);
  const id =
    m.buttonsResponseMessage?.selectedButtonId ??
    m.templateButtonReplyMessage?.selectedId ??
    m.listResponseMessage?.singleSelectReply?.selectedRowId ??
    nativeFlowId(m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson);
  if (typeof id === "string" && id) return { kind: "action", id: id.slice(0, 200) };
  const loc = m.locationMessage ?? m.liveLocationMessage;
  if (loc && Number.isFinite(loc.degreesLatitude)) return { kind: "location", lat: loc.degreesLatitude, lng: loc.degreesLongitude };
  if (m.audioMessage) return { kind: "media", type: "audio" };
  if (m.imageMessage) return { kind: "media", type: "image" };
  if (m.documentMessage) return { kind: "media", type: "document" };
  const text = String(m.conversation ?? m.extendedTextMessage?.text ?? "").trim();
  if (!text) return { kind: "ignored" };
  const n = /^\d{1,2}$/.test(text) ? Number(text) : 0;
  if (n >= 1 && n <= numbered.length) return { kind: "action", id: numbered[n - 1] };
  return { kind: "text", text: text.slice(0, 1000) };
}

/** Card com as opções também numeradas no texto. Botões: até 3 (título 20). Lista: até 10 linhas (título 24). */
export function numberedCard(
  text: string,
  options: { id: string; title: string; description?: string }[],
  asList = false,
  buttonText = "Ver opções",
): { card: Card; ids: string[] } {
  const opts = options.slice(0, asList ? 10 : 3);
  const body = `${text}\n\n${opts.map((o, i) => `${i + 1}. ${o.title}`).join("\n")}`.slice(0, 3900);
  const card: Card = asList
    ? {
        text: body,
        buttonText,
        sections: [
          {
            title: "Opções",
            rows: opts.map((o) => ({ id: o.id, title: o.title.slice(0, 24), ...(o.description ? { description: o.description.slice(0, 72) } : {}) })),
          },
        ],
      }
    : { text: body, buttons: opts.map((o) => ({ id: o.id, title: o.title.slice(0, 20) })) };
  return { card, ids: opts.map((o) => o.id) };
}

export type IncomingKey = { remoteJid?: string | null; fromMe?: boolean | null; id?: string | null; senderPn?: string | null; remoteJidAlt?: string | null };

export const jidUser = (jid?: string | null) => (jid ?? "").split("@")[0].split(":")[0];
const isPn = (jid?: string | null) => /@s\.whatsapp\.net$/.test(jid ?? "");

/** Quem escreveu, com número real. Grupos, status e mensagens do próprio número são ignorados. */
export function sender(key: IncomingKey): { phone: string; replyTo: string } | { ignore: string; lidOnly?: boolean } {
  const remote = key.remoteJid ?? "";
  if (!remote || /@(g\.us|broadcast|newsletter)$/.test(remote)) return { ignore: "chat" };
  if (key.fromMe) return { ignore: "fromMe" };
  const pn = isPn(remote) ? remote : isPn(key.senderPn) ? key.senderPn : isPn(key.remoteJidAlt) ? key.remoteJidAlt : null;
  const phone = jidUser(pn).replace(/\D/g, "");
  if (!/^\d{12,13}$/.test(phone)) return { ignore: "sem número", lidOnly: /@lid$/.test(remote) };
  return { phone, replyTo: remote };
}
