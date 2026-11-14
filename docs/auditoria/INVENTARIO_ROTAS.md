# Inventário de rotas · ComandaZero

Atualizado em 14/11/2026, branch `p0-producao`. Rodada anterior: commit `6d1edd0` (ver histórico do git).
Legenda: `REAL/TESTADO` funciona com banco real e tem teste automatizado · `DEMONSTRAÇÃO` lojas `cafe-e-flor` e `burger-station` (dados no navegador, abertas sem login) · `PARCIAL` · `AUSENTE`.

Proteção: o `proxy.ts` redireciona anônimo para `/entrar?next=…` e responde **403** a quem está logado sem vínculo; o layout do painel confere de novo o papel exigido por página (`PAGE_PERMISSION` em `src/lib/server/auth.ts`).

## Páginas

| Rota | Quem usa | Exige | Status | Teste |
|---|---|---|---|---|
| `/` | Público | — | REAL/TESTADO · landing com prints reais, planos de `src/lib/plans.ts` | `e2e/landing.spec.ts` |
| `/entrar` | Lojista e equipe | — | REAL/TESTADO · mostrar senha, força, máscara de WhatsApp, aceite dos Termos, reenvio com espera | `e2e/auth.spec.ts` |
| `/auth/callback` | Links de e-mail | token do e-mail | REAL/TESTADO · `token_hash` e `code`; link inválido volta com aviso | `e2e/auth.spec.ts` |
| `/auth/confirmado` | Conta nova | login | REAL/TESTADO | `e2e/auth.spec.ts` |
| `/redefinir-senha` | Quem pediu recuperação | sessão de recuperação | REAL/TESTADO | `e2e/auth.spec.ts` |
| `/onboarding` | Conta nova | login | REAL/TESTADO · 5 passos, loja real com 14 dias de teste | `e2e/fluxos.spec.ts` › Super Admin |
| `/painel/nova-loja` | Endereço antigo | login | Redireciona para `/onboarding` | — |
| `/termos`, `/privacidade` | Público | — | REAL/TESTADO · versão e data visíveis | `e2e/auth.spec.ts` |
| `/loja/[slug]` | Cliente | — | REAL/TESTADO · banco para loja real, 404 para slug inexistente, JSON-LD, canonical | `e2e/p0.spec.ts`, `e2e/seo.spec.ts` |
| `/loja/[slug]/pedido/[id]?t=` | Cliente | token do pedido | REAL/TESTADO · qualquer aparelho, atualiza a cada 5 s, avaliação após entregue | `e2e/p0.spec.ts` |
| `/painel` | Lojista | — | REAL/TESTADO · anônimo vai para a demo; logado vai para a própria loja, Super Admin ou onboarding | — |
| `/painel/[slug]` (+ pedidos, kds, pdv, mesas, cardapio, fidelidade, aparencia, integracoes, treinamento) | Equipe por papel | login + papel (loja real) | REAL/TESTADO · Realtime de pedidos < 3 s entre aparelhos | `e2e/p0.spec.ts` |
| `/painel/[slug]/equipe` | Dono | `team.manage` | REAL/TESTADO | `e2e/p0.spec.ts` › Assinatura e equipe |
| `/painel/[slug]/assinatura` | Dono | `billing.manage` | PARCIAL · tela e regras prontas; cobrança ativa com `ASAAS_API_KEY` (ver `docs/PASSOS_MANUAIS.md`) | `e2e/p0.spec.ts` |
| `/super-admin` | Admin da plataforma | `platform_admins` | REAL/TESTADO · dados reais, MRR por assinatura, suspender/reativar com histórico | `e2e/p0.spec.ts` |
| `/acesso-negado` | Logado sem vínculo | — | REAL/TESTADO (403) | `e2e/p0.spec.ts` |
| `/robots.txt`, `/sitemap.xml` | Buscadores | — | REAL/TESTADO · demos fora do sitemap | `e2e/seo.spec.ts` |

## APIs

| Rota | Função | Proteção | Status |
|---|---|---|---|
| `POST /api/pedidos` | Cria pedido de loja real | Zod + `create_order` (preço, opções, cupom, zona e sinal recalculados no banco) + idempotência | REAL/TESTADO |
| `POST /api/pedidos/[id]/status` | Avança/cancela | sessão + `set_order_status` (papel) | REAL/TESTADO |
| `GET /api/rastreio` | Acompanhamento | token ≥ 32 + limite por IP | REAL/TESTADO |
| `POST /api/avaliacoes` | Avaliação do cliente | token + pedido entregue + uma por pedido | REAL/TESTADO (banco) |
| `POST /api/produtos/foto` | Foto do produto | dono/gerente + bytes de imagem conferidos + 2 MB | REAL |
| `POST/PATCH/DELETE /api/equipe` | Equipe | só dono; histórico em `audit_log` | REAL/TESTADO |
| `POST /api/assinatura` | Cria assinatura no Asaas | só dono; preço de `plans.ts` | PARCIAL (depende de `ASAAS_API_KEY`) |
| `POST /api/webhooks/assinatura` | Eventos do Asaas | token no header + idempotência | REAL (503 sem token configurado) |
| `PATCH /api/admin/lojas/[id]` | Suspender/reativar/plano | só admin da plataforma; histórico | REAL/TESTADO |
| `POST /api/webhooks/pagamentos/[gateway]` | Pagamento de pedido | assinatura por gateway + idempotência | REAL/TESTADO (Mercado Pago) |
| `GET /api/manifest/[slug]`, `/api/tenant-icon/[slug]` | PWA | pública | REAL/TESTADO |
| `/api/whatsapp/*`, `/api/webhooks/whaileys` | WhatsApp da loja | selo do canal, HMAC, dedupe | REAL |

## Banco (migrações em `supabase/migrations/`)

| Migração | Conteúdo |
|---|---|
| `20261114000100_p0_producao.sql` | `is_demo`, papéis, `create_order`, rastreio, status, `payment_events`, Storage, `save_product`, `create_my_tenant` |
| `20261114000200_aceite_legal.sql` | `legal_acceptances` gravado por gatilho no cadastro |
| `20261114000300_assinaturas_auditoria.sql` | `subscriptions`, teste de 14 dias, `audit_log`, `platform_overview` |
| `20261114000400_onboarding.sql` | `create_my_tenant_v2` (modos, horário, cores, cardápio modelo ou vazio) |
| `20261114000500_somente_leitura.sql` | Gatilhos que travam edição em atraso > 7 dias (pedidos continuam) |
| `20261114000600_equipe.sql` | `team_members`, `user_id_by_email` (só servidor) |
| `20261114000700_avaliacoes.sql` | `order_reviews`, `submit_order_review`, `tenant_rating` (média só com 10+) |
