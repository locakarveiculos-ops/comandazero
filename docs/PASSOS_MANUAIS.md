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

Hoje o Supabase manda os e-mails com o servidor padrão: **máximo 2 por hora** e **sem modelo em português**
(o plano gratuito recusa modelo próprio sem SMTP; erro `entitlement_required` ao aplicar).

1. Criar conta no [Resend](https://resend.com), adicionar o domínio `comandazero.com.br` e publicar no DNS os registros SPF, DKIM e DMARC que ele mostrar. Conferir: domínio "Verified".
2. Gerar uma API key do Resend.
3. Supabase › Authentication › Emails › SMTP Settings:
   - Host `smtp.resend.com`, porta `465`, usuário `resend`, senha = API key.
   - Remetente `nao-responda@comandazero.com.br`, nome `ComandaZero`.
4. Supabase › Authentication › Email Templates: colar o HTML de cada arquivo de `supabase/templates/`
   (`confirmacao.html`, `recuperacao.html`, `convite.html`, `link_magico.html`, `troca_email.html`) com os assuntos de `supabase/config.toml`.
5. Supabase › Authentication › Rate Limits: subir "emails sent" para pelo menos 30/hora.
6. **Religar a confirmação de e-mail** (foi desligada a pedido): Authentication › Providers › Email › "Confirm email" ligado.
7. Conferir: criar conta nova em `/entrar?modo=cadastro`, receber "Confirme sua conta na ComandaZero", clicar e cair em `/auth/confirmado`.

## 3. URL do site

1. Quando o domínio estiver na Vercel: Supabase › Authentication › URL Configuration
   - Site URL: `https://comandazero.com.br`
   - Redirect URLs: `https://comandazero.com.br/**`, `https://comandazero.vercel.app/**`
2. Vercel › Settings › Environment Variables: `NEXT_PUBLIC_SITE_URL=https://comandazero.com.br` (Production) e redeploy.

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
3. Não precisa cadastrar webhook: cada link já leva `https://<domínio>/api/webhooks/assinatura`. O aviso não é assinado, por isso o sistema confirma todo pagamento no `/payment_check` antes de ativar o plano.
4. Não existe sandbox: para testar, assine o plano numa loja de teste e pague R$ 1,00 ajustando o preço temporariamente, ou pague um plano real e estorne pelo app.
5. Conferir: depois do pagamento, a tela de Assinatura mostra **Ativa** e o comprovante; o Super Admin mostra "Pagamento recebido" no histórico e o MRR sobe.
6. **Recorrência**: a API da InfinitePay não cobra sozinha. O plano anual vale 12 meses; no mensal, o dono renova pela tela de Assinatura (aviso 10 dias antes; só leitura 7 dias após vencer).

## 6. Login com Google (opcional)

1. Google Cloud Console › Credentials › OAuth client (Web). Redirect: `https://dazxugmfqkqixcbdocjf.supabase.co/auth/v1/callback`.
2. Supabase › Authentication › Providers › Google: colar client id e secret.
3. Vercel: `NEXT_PUBLIC_AUTH_GOOGLE=1` e redeploy.

## 7. Domínio e subdomínios das lojas

1. Vercel › Domains: adicionar `comandazero.com.br` e `*.comandazero.com.br`.
2. No DNS (Cloudflare ou registro.br): apontar conforme a Vercel indicar (wildcard exige nameservers da Vercel ou CNAME por loja).
3. `NEXT_PUBLIC_ROOT_DOMAIN=comandazero.com.br` na Vercel.

## 8. Antes da primeira loja pagante

- [ ] Itens 1, 2, 3 e 5 concluídos.
- [ ] `docs/auditoria/REPORT_P0.md` sem pendência marcada como bloqueante.
- [ ] Usuários de teste (`*@comandazero.test`) e a loja `loja-teste-p0` mantidos só para testes (não aparecem para clientes: a loja não é divulgada).
