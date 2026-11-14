# Relatório P0 · ComandaZero rumo à primeira loja pagante

Branch `p0-producao` (ponto de partida: tag `checkpoint-pre-p0` = `aa52035`). Data: 14/11/2026.
Banco: Supabase `dazxugmfqkqixcbdocjf` (sa-east-1). Migrações aplicadas e versionadas em `supabase/migrations/`.

## Resultado das verificações

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 erros |
| `npx eslint .` | 0 problemas |
| `npx vitest run` | 40/40 |
| `npx next build` | ok |
| `npx playwright test` | **95/95** (3,3 min); Realtime medido: 867 ms |
| Lighthouse | **não medido**: pacote não instalado (instalar exige autorização). Pendência |

## Critérios de aceite

| Critério | Situação | Prova |
|---|---|---|
| Cadastro → e-mail PT-BR → `/auth/confirmado` → onboarding → loja no ar | **Parcial**: fluxo e páginas prontos e testados; modelos PT-BR prontos, mas o Supabase gratuito recusa modelo próprio sem SMTP (`entitlement_required`) e a confirmação de e-mail está desligada a pedido | `e2e/auth.spec.ts`, `e2e/fluxos.spec.ts` › onboarding, `docs/PASSOS_MANUAIS.md` §2 |
| Pedido no celular visível no KDS do tablet em < 3 s | **OK** (0,2 a 0,9 s medido) | `e2e/p0.spec.ts` › pedido real entre aparelhos |
| Anônimo em `/painel/<loja real>/pedidos` e `/super-admin` → `/entrar` | **OK** | `e2e/p0.spec.ts` |
| Anônimo em `/painel/cafe-e-flor/pedidos` → `/entrar` | **Diferente do pedido**: `cafe-e-flor` é loja de demonstração (`is_demo`), mantida aberta para visitação, conforme a regra "demo isolada por is_demo" e o link "Ver demonstração do painel" | `e2e/p0.spec.ts` › loja de demonstração continua aberta. Para fechar: `DEMO_TENANTS=` vazio na Vercel |
| Sem nota ou preço fictício em loja real | **OK** | Nota real só com 10+ avaliações (`tenant_rating`); preço sempre do banco; `e2e/p0.spec.ts` |
| Termos e Privacidade publicados, aceite gravado com versão e data | **OK** | `/termos`, `/privacidade`, `legal_acceptances`; `e2e/auth.spec.ts` |
| Todos os comandos passam | ver tabela acima | — |

## O que foi entregue (por commit)

- **Auth**: `/auth/callback` (token_hash e code), `/auth/confirmado`, `/redefinir-senha`, erros em português (`src/lib/auth-errors.ts`), senha mínima 8 no Supabase.
- **Entrar**: mostrar/ocultar senha, medidor de força, máscara de WhatsApp, aceite dos Termos obrigatório, opt-in de marketing separado, reenvio com espera de 60 s, Google atrás de `NEXT_PUBLIC_AUTH_GOOGLE`.
- **LGPD**: Termos de Uso e Política de Privacidade com versão; aceite gravado por gatilho no cadastro (`legal_acceptances`).
- **Onboarding** em 5 passos (`/onboarding`): nome/endereço/WhatsApp/cidade, formas de venda, horário, cores com prévia, cardápio modelo ou vazio. Loja nasce com 14 dias de teste.
- **Super Admin** com dados reais (`platform_overview`): MRR só de assinaturas pagantes pelo valor contratado, lojas reais separadas das demonstrações, trocar plano, suspender/reativar, histórico (`audit_log`). "Restaurar demo" removido.
- **Planos** em `src/lib/plans.ts` (Essencial R$ 99,90 · Profissional R$ 189,90 · Rede R$ 299,90; anual 79,90/149,90/249,90; fundador R$ 129,90), usados em landing, assinatura e Super Admin.
- **Assinatura** (`/painel/<loja>/assinatura`, só dono): Asaas recorrente (Pix/boleto/cartão na fatura), webhook com token e idempotência, aviso de teste e atraso, painel **só leitura** após 7 dias de atraso (pedidos continuam).
- **Equipe** (`/painel/<loja>/equipe`, só dono): convite por e-mail, troca de papel, remoção, histórico.
- **Avaliações** reais: cliente avalia pedido entregue pelo link com token, uma por pedido; média só com 10+.
- **SEO**: 404 real para loja inexistente, canonical, JSON-LD (`CafeOrCoffeeShop`/`Bakery`/`Restaurant`), `robots.txt`, `sitemap.xml` sem demos.
- **Landing** nova com prints reais do sistema: vitrine interativa, segmentos, jornada em 5 passos, abas por perfil, WhatsApp, central de treinamento, calculadora com comparação, planos, FAQ, rodapé com selo WCAG.
- **Correções**: nome da loja espremido no celular; foto do produto limitada a 40% da tela; seletor do painel listava lojas demo do navegador; botão "Enviar comprovante" (não enviava nada) oculto em loja real; mensagem de erro genérica de API citava WhatsApp em qualquer rota.
- **Treinamento**: artigos novos (Onboarding, Equipe, Assinatura, Avaliações), Super Admin e Entrar reescritos; 36 prints recapturados.

## Bugs encontrados pelos testes nesta rodada

1. **Gatilho de só leitura impedia criar loja** (`record "new" has no field "tenant_id"`): o `case` lia `new.tenant_id` na tabela `tenants`. Corrigido lendo a linha como `jsonb` e liberando INSERT de loja nova. Validado no banco: cria loja; edita em dia; bloqueia produto, loja e exclusão com 8 dias de atraso.
2. **`platform_overview` ambígua** (`created_at`): Super Admin vinha vazio. Corrigido com `#variable_conflict use_column` e aliases.

## Validações feitas direto no banco

| Cenário | Resultado |
|---|---|
| Avaliar pedido não entregue | recusado `PEDIDO_NAO_ENTREGUE` |
| Avaliar com token errado | recusado `PEDIDO_INEXISTENTE` |
| Avaliar duas vezes | recusado `JA_AVALIADO` |
| Média com 1 avaliação | `rating = null` (não exibe) |
| Anônimo lê `order_reviews` | 0 linhas (RLS) |
| `platform_overview` como lojista / anônimo | `SEM_PERMISSAO` / permissão negada |
| `user_id_by_email` como usuário logado | permissão negada (só servidor) |
| Atraso 3 dias | edita normalmente |
| Atraso 8 dias | edição bloqueada, pedido avança |

## Pendências (fora do código ou próximos passos)

- **Manuais** (`docs/PASSOS_MANUAIS.md`): revogar tokens e trocar a senha do admin; SMTP (Resend) + modelos PT-BR + religar confirmação de e-mail; chave e webhook do Asaas; domínio próprio.
- **Lighthouse ≥ 90**: não medido nesta rodada.
- **P1**: mesas e fidelidade da loja real ainda gravam no navegador; Pix dinâmico com confirmação automática para pedidos de loja real; conversão de foto para WebP no upload; filtro de período e CSV no dashboard; layout do PDV para tablet ≤ 1024 px com carrinho fixo e alternância grade/lista.
