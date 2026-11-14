// Motor de e-mail transacional Resend. A chamada real roda no servidor com RESEND_API_KEY.

export type EmailMessage = { from: string; to: string[]; subject: string; html: string; reply_to?: string; tags?: { name: string; value: string }[] };

export const RESEND_API = "https://api.resend.com";

/** Remetente do domínio verificado da loja, ex.: "Café e Flor <pedidos@notificacoes.cafeeflor.seudominio.com.br>". */
export const fromAddress = (name: string, subdomain: string, local = "pedidos") => `${name.replace(/[<>"]/g, "")} <${local}@${subdomain}>`;

export const tenantEmailDomain = (tenantSubdomain: string, rootDomain: string) => `notificacoes.${tenantSubdomain}.${rootDomain}`;

/** Registros DNS que o Resend pede para verificar o domínio (valores reais vêm de POST /domains). */
export function dnsRecordsFor(domain: string) {
  return [
    { type: "MX", name: `send.${domain}`, value: "feedback-smtp.sa-east-1.amazonses.com", priority: 10 },
    { type: "TXT", name: `send.${domain}`, value: "v=spf1 include:amazonses.com ~all" },
    { type: "TXT", name: `resend._domainkey.${domain}`, value: "p=MIGfMA0GCSqGSIb3DQEB…(chave DKIM gerada pelo Resend)" },
    { type: "TXT", name: `_dmarc.${domain}`, value: "v=DMARC1; p=none;" },
  ];
}

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
