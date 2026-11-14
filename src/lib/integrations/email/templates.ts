// Templates HTML de e-mail transacional (compatíveis com clientes de e-mail: tabelas e estilos inline).
import type { Order, Tenant } from "@/lib/types";
import { saasBrand } from "@/config/saas-brand";
import { MODE_LABEL, fmtDateTime, money } from "@/lib/utils";

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function shell(t: Pick<Tenant, "name" | "theme">, title: string, body: string, footer: string) {
  const { primary, primaryInk, paper, ink, line } = t.theme;
  const bg = t.theme.dark ? "#F4F4F5" : paper;
  const fg = t.theme.dark ? "#18181B" : ink;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:${bg};font-family:Arial,Helvetica,sans-serif;color:${fg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${line}">
<tr><td style="background:${primary};color:${primaryInk};padding:22px 28px;font-size:20px;font-weight:bold">${esc(t.name)}</td></tr>
<tr><td style="padding:28px">${body}</td></tr>
<tr><td style="padding:16px 28px;background:#fafafa;color:#57534e;font-size:12px;line-height:18px">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const row = (a: string, b: string, bold = false) =>
  `<tr><td style="padding:6px 0;${bold ? "font-weight:bold;" : ""}">${a}</td><td align="right" style="padding:6px 0;${bold ? "font-weight:bold;" : ""}">${b}</td></tr>`;

export function orderReceiptEmail(order: Order, tenant: Tenant, trackUrl: string) {
  const items = order.items
    .map(
      (i) =>
        `${row(`${i.qty}× ${esc(i.name)}${i.options.length ? `<br><span style="color:#78716c;font-size:12px">${esc(i.options.map((o) => o.name).join(", "))}</span>` : ""}`, money(i.unitPrice * i.qty))}`,
    )
    .join("");
  return {
    subject: `Pedido #${order.number} recebido · ${tenant.name}`,
    html: shell(
      tenant,
      `Pedido #${order.number}`,
      `<h1 style="margin:0 0 6px;font-size:22px">Recebemos seu pedido, ${esc(order.customer.name.split(" ")[0])}!</h1>
<p style="margin:0 0 18px;color:#57534e">Pedido <b>#${order.number}</b> · ${MODE_LABEL[order.mode]} · ${fmtDateTime(order.createdAt)}</p>
<table role="presentation" width="100%" style="border-top:1px solid #e7e5e4;border-bottom:1px solid #e7e5e4;font-size:14px">${items}</table>
<table role="presentation" width="100%" style="margin-top:10px;font-size:14px">
${row("Subtotal", money(order.subtotal))}${order.deliveryFee ? row("Entrega", money(order.deliveryFee)) : ""}${order.discount ? row("Desconto", `- ${money(order.discount)}`) : ""}${row("Total", money(order.total), true)}</table>
<p style="margin:24px 0 0"><a href="${trackUrl}" style="display:inline-block;background:${tenant.theme.primary};color:${tenant.theme.primaryInk};padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Acompanhar pedido</a></p>`,
      `${esc(tenant.address.street)} · ${esc(tenant.address.city)}-${tenant.address.uf}<br>Este é um comprovante não fiscal.`,
    ),
  };
}

export function cakeConfirmationEmail(order: Order, tenant: Tenant) {
  const cake = order.items.find((i) => i.cake);
  const c = cake?.cake;
  return {
    subject: `Encomenda confirmada para ${c ? fmtDateTime(c.pickupAt) : "a data combinada"} · ${tenant.name}`,
    html: shell(
      tenant,
      "Encomenda confirmada",
      `<h1 style="margin:0 0 12px;font-size:22px">Sua encomenda está confirmada 🎂</h1>
<table role="presentation" width="100%" style="font-size:14px">
${c ? `${row("Peso", `${c.kg.toLocaleString("pt-BR")} kg`)}${row("Massa", esc(c.massa))}${row("Recheio", esc(c.recheio))}${row("Cobertura", esc(c.cobertura))}${c.frase ? row("Frase no topo", `“${esc(c.frase)}”`) : ""}${row("Retirada", fmtDateTime(c.pickupAt), true)}` : ""}
${row("Total", money(order.total), true)}${order.deposit ? row("Sinal pago (50%)", money(order.deposit)) + row("Restante na retirada", money(order.total - order.deposit), true) : ""}</table>`,
      `Alterações até 24 h antes da retirada pelo WhatsApp da loja.`,
    ),
  };
}

export function dailyCloseEmail(tenant: Tenant, data: { date: string; revenue: number; orders: number; avg: number; byMethod: Record<string, number>; top: { name: string; qty: number }[] }) {
  return {
    subject: `Fechamento de caixa ${data.date} · ${tenant.name}`,
    html: shell(
      tenant,
      "Fechamento de caixa",
      `<h1 style="margin:0 0 4px;font-size:22px">Fechamento de caixa</h1><p style="margin:0 0 18px;color:#57534e">${data.date}</p>
<table role="presentation" width="100%" style="font-size:14px">${row("Faturamento", money(data.revenue), true)}${row("Pedidos", String(data.orders))}${row("Ticket médio", money(data.avg))}</table>
<h2 style="font-size:15px;margin:20px 0 6px">Por forma de pagamento</h2><table role="presentation" width="100%" style="font-size:14px">${Object.entries(data.byMethod).map(([k, v]) => row(esc(k), money(v))).join("")}</table>
<h2 style="font-size:15px;margin:20px 0 6px">Mais vendidos</h2><table role="presentation" width="100%" style="font-size:14px">${data.top.map((t) => row(esc(t.name), `${t.qty} un.`)).join("")}</table>`,
      "Relatório automático enviado ao fechar o caixa.",
    ),
  };
}

/** E-mail do próprio SaaS (identidade ComandaZero), não da loja. */
export function welcomeTenantEmail(tenant: Tenant, panelUrl: string, storeUrl: string, origin = "") {
  const { navy, gold, warmWhite } = saasBrand.palette;
  const logo = `${origin}${saasBrand.assets.logoDarkBackground}`;
  return {
    subject: `Bem-vindo à ${saasBrand.name}, ${tenant.name}!`,
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Boas-vindas</title></head>
<body style="margin:0;background:${warmWhite};font-family:Arial,Helvetica,sans-serif;color:${navy}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${warmWhite};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #DED9D1">
<tr><td style="background:${navy};padding:22px 28px"><img src="${logo}" alt="${saasBrand.name}" height="40" style="display:block;height:40px;width:auto"></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 10px;font-size:22px;color:${navy}">A loja ${esc(tenant.name)} já está no ar</h1>
<p style="line-height:22px;color:#2B2B2B">O cardápio digital da sua loja já pode ser instalado no celular dos seus clientes, com a sua marca.</p>
<ol style="line-height:24px;padding-left:18px;color:#2B2B2B"><li>Suba sua logo e escolha as cores</li><li>Cadastre produtos e complementos</li><li>Conecte o WhatsApp e o Pix</li><li>Imprima os QR Codes das mesas</li></ol>
<p><a href="${panelUrl}" style="display:inline-block;background:${navy};color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Abrir meu painel</a></p>
<p style="font-size:13px;color:#526076">Cardápio: <a href="${storeUrl}" style="color:#8A5C21">${storeUrl}</a></p>
</td></tr>
<tr><td style="padding:16px 28px;background:#FAF8F5;color:#526076;font-size:12px;border-top:3px solid ${gold}">${saasBrand.name} · ${saasBrand.slogan}</td></tr>
</table></td></tr></table></body></html>`,
  };
}
