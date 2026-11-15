# Passos manuais (fora do código)

O que precisa ser feito à mão em painéis externos para a ComandaZero receber a primeira loja pagante.
Cada item diz **onde**, **o quê** e **como conferir**. Nenhum segredo vai para o repositório: valores ficam só na Vercel e no `.env.local`.

## 1. Segurança imediata (fazer primeiro)

1. **Revogar os tokens usados no setup** (foram colados em conversa):
   - GitHub: Settings › Developer settings › Personal access tokens › revogar o token usado no push.
   - Vercel: Account Settings › Tokens › apagar o token do deploy.
   - Supabase: Account › Access Tokens › revogar o `sbp_` usado.
   - Depois, apagar `GITHUB_TOKEN`, `VERCEL_TOKEN` e `SUPABASE_ACCESS_TOKEN` do `.env.local`.
2. **Trocar a senha do admin** `jefferson.22gs@gmail.com` (foi enviada em conversa): entrar em `/entrar` › Esqueci minha senha.

## 2. E-mails de autenticação (Supabase + Resend)

Situação em 15/11/2026: a chave do Resend recebida é **só de envio** (`restricted_api_key`): não cadastra domínio.
Enquanto o domínio não estiver verificado no Resend, o Supabase continua no servidor padrão (2 e-mails/hora, textos em inglês).

**O DNS de `comandazero.com.br` hoje bloqueia e-mail** (padrão de domínio novo na Cloudflare):
`MX .` (MX nulo), `TXT v=spf1 -all` e `_dmarc v=DMARC1; p=reject;`. Esses três precisam ser trocados pelos do Resend.

1. Resend › Domains › Add: `comandazero.com.br`, região São Paulo (ou mandar uma chave "Full access" para eu fazer).
2. Copiar os registros que o Resend mostrar (MX e TXT em `send.comandazero.com.br`, TXT DKIM em `resend._domainkey`).
   Eu crio na Cloudflare (DNS only), troco o SPF do raiz e o DMARC para `p=none` durante a validação.
3. Resend › Verify. Conferir "Verified".
4. Depois disso eu configuro o SMTP no Supabase (host `smtp.resend.com`, porta 465, usuário `resend`, remetente
   `nao-responda@comandazero.com.br`), aplico os modelos em português de `supabase/templates/` e subo o limite para 30 e-mails/hora.
5. **Confirmação de e-mail no cadastro**: segue desligada a pedido do dono. Religar só com autorização.

## 3. URL do site (feito em 15/11/2026)

- Supabase: Site URL `https://comandazero.com.br`; Redirect URLs com `comandazero.com.br/**`, `www.`, `*.comandazero.com.br/**`, `comandazero.vercel.app/**` e localhost.
- Vercel (Production e Preview): `NEXT_PUBLIC_SITE_URL=https://comandazero.com.br`, `NEXT_PUBLIC_ROOT_DOMAIN=comandazero.com.br`, `APP_URL=https://comandazero.com.br`, `INFINITEPAY_HANDLE=marco-boggian`.

## 4. Variáveis na Vercel (Production)

| Variável | Para quê | Onde pegar |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Links dos e-mails, canonical, sitemap | Domínio oficial |
| `NEXT_PUBLIC_SALES_WHATSAPP` | Botão flutuante da landing | Número comercial, `55DDDNUMERO` |
| `INFINITEPAY_HANDLE` | Conta que recebe as assinaturas | InfiniteTag sem `$` (padrão no código: `marco-boggian`) |
| `INFINITEPAY_API_KEY` | Opcional: link de uso único que vence em 7 dias | Conta Web › Configurações do Checkout › API Key (`inchk_…`) |
| `MERCADOPAGO_WEBHOOK_SECRET` (e demais `*_WEBHOOK_SECRET`) | Pagamento dos pedidos das lojas | Painel de cada gateway |
| `NEXT_PUBLIC_AUTH_GOOGLE` | Mostra "Continuar com Google" | `1` só depois do item 6 |

Enquanto o checkout integrado não estiver ligado na InfinitePay, a tela de Assinatura avisa "pagamento online sendo ativado" (nunca simula cobrança).

## 5. InfinitePay (recebimento de todos os planos)

Conta configurada: InfiniteTag `$marco-boggian`. CNPJ informado pelo proprietário: 59.760.458/0001-91 (vínculo com a conta ainda não validado pela API). O recebimento é direcionado pela InfiniteTag, não pelo CNPJ.

1. **Ligar o Checkout Integrado** (obrigatório): App InfinitePay ou [Conta Web](https://app.infinitepay.io/external-checkout#configuracoes) › Configurações do Checkout › **Habilitar checkout integrado**. Hoje a API responde `external_checkout_not_enabled` para esta conta.
2. (Opcional) Na mesma tela, criar uma API Key (`inchk_…`) e cadastrar `INFINITEPAY_API_KEY` na Vercel. Com ela, cada link de pagamento vale 7 dias e aceita um único pagamento.
3. Mesmo contrato do Portaria Prime (homologado lá em 21/10/2026 com esta mesma conta). Em 15/11/2026 a mesma chamada responde `external_checkout_not_enabled`: a opção foi desligada na conta depois disso. Ao religar, Portaria Prime e ComandaZero voltam a funcionar juntos.
4. Não precisa cadastrar webhook: cada link já leva `https://<domínio>/api/webhooks/assinatura`. O aviso não é assinado, por isso o sistema confirma todo pagamento no `/payment_check` antes de ativar o plano.
5. Não existe sandbox: para testar, assine o plano numa loja de teste e pague R$ 1,00 ajustando o preço temporariamente, ou pague um plano real e estorne pelo app.
6. Conferir: depois do pagamento, a tela de Assinatura mostra **Ativa** e o comprovante; o Super Admin mostra "Pagamento recebido" no histórico e o MRR sobe.
7. **Recorrência**: a API da InfinitePay não cobra sozinha. O plano anual vale 12 meses; no mensal, o dono renova pela tela de Assinatura (aviso 10 dias antes; só leitura 7 dias após vencer).

## 6. Login com Google (opcional)

1. Google Cloud Console › Credentials › OAuth client (Web). Redirect: `https://dazxugmfqkqixcbdocjf.supabase.co/auth/v1/callback`.
2. Supabase › Authentication › Providers › Google: colar client id e secret.
3. Vercel: `NEXT_PUBLIC_AUTH_GOOGLE=1` e redeploy.

## 7. Domínio e subdomínios das lojas (feito em 15/11/2026)

- Cloudflare (zona ativa, nameservers `jeff`/`jo.ns.cloudflare.com`), todos **DNS only**:
  `A comandazero.com.br → 216.198.79.1` e `64.29.17.1`; `CNAME www` e `CNAME *` → `070244b9354b2391.vercel-dns-017.com`.
- Vercel: `comandazero.com.br`, `www.comandazero.com.br` (redireciona 308 para o raiz) e `*.comandazero.com.br` (subdomínio por loja).
- O token da Cloudflare tem restrição de IP: só funciona saindo por IPv4 (`curl -4`). Pelo IPv6 a API responde 9109.
- Certificado do wildcard é emitido pela Vercel; até sair, `<loja>.comandazero.com.br` pode falhar no HTTPS. O caminho `/loja/<slug>` funciona sempre.

## 8. Antes da primeira loja pagante

- [ ] Itens 1, 2, 3 e 5 concluídos.
- [ ] `docs/auditoria/REPORT_P0.md` sem pendência marcada como bloqueante.
- [ ] Usuários de teste (`*@comandazero.test`) e a loja `loja-teste-p0` mantidos só para testes (não aparecem para clientes: a loja não é divulgada).
