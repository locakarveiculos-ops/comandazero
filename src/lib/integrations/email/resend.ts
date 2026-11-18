// Motor de e-mail transacional Resend. A chamada real roda no servidor com RESEND_API_KEY.

export type EmailMessage = { from: string; to: string[]; subject: string; html: string; reply_to?: string; tags?: { name: string; value: string }[] };

export const RESEND_API = "https://api.resend.com";

/**
 * Domínio de envio verificado no Resend (fixo para todo o sistema). Cada loja envia com o próprio nome e um
 * endereço só dela: "Café e Flor <cafeeflor@comandazero.com.br>". Assim não é preciso verificar um domínio por
 * loja no Resend nem criar DNS por loja; respostas do cliente vão para o e-mail da loja (reply_to).
 */
export const EMAIL_DOMAIN = process.env.RESEND_FROM_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN || "comandazero.com.br";

/** Endereço da loja no domínio verificado: só letras e números do subdomínio (máx. 64, limite do e-mail). */
export const tenantEmailLocal = (tenantSubdomain: string) => tenantSubdomain.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 64) || "pedidos";

/** Remetente da loja, ex.: "Café e Flor <cafeeflor@comandazero.com.br>". O nome não aceita < > " (quebrariam o cabeçalho). */
export const fromAddress = (name: string, tenantSubdomain: string, domain = EMAIL_DOMAIN) => `${name.replace(/[<>"\r\n]/g, "").trim() || "Loja"} <${tenantEmailLocal(tenantSubdomain)}@${domain}>`;

export const buildSendRequest = (msg: EmailMessage, apiKey = "<RESEND_API_KEY>") => ({
  method: "POST" as const,
  url: `${RESEND_API}/emails`,
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: msg,
});

export async function sendEmail(msg: EmailMessage, apiKey = process.env.RESEND_API_KEY) {
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada");
  const req = buildSendRequest(msg, apiKey);
  const r = await fetch(req.url, { method: req.method, headers: req.headers, body: JSON.stringify(req.body), signal: AbortSignal.timeout(15000) });
  const d = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!r.ok) throw new Error(`Resend: ${d.message ?? r.status}`);
  return d.id as string;
}
