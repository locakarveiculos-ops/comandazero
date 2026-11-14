# Relatório final · Auditoria e Treinamento (rodada 1)

Data: 14/11/2026 · Branch `auditoria-e-treinamento` (checkpoint `checkpoint-pre-auditoria` = `6d1edd0`).
Escopo desta rodada, escolhido com o Jefferson: **Fase 0 (auditoria) + Fases 3 e 4 (tours e central de treinamento com prints reais)**. As fases P0/P1/P2 de produto estão planejadas em `PLANO_P0_P1_P2.md` e **não foram implementadas** nesta rodada.

## Resultado por área

| Área | Estado antes (evidência) | Mudança implementada (arquivos) | Testes executados / resultado | Pendências externas |
|---|---|---|---|---|
| Auditoria de rotas | Sem inventário | `docs/auditoria/*`, `e2e/baseline.spec.ts` | 15 rotas × 3 telas = 45 combinações, 0 problemas | — |
| Layout responsivo | Rolagem lateral em Integrações (desktop/tablet/celular), Cardápio e Super Admin (celular) | `panel-shell.tsx`, `integracoes/page.tsx`, `cardapio/page.tsx`, `super-admin/page.tsx` | baseline: 0 rolagens laterais | — |
| Prévia de aparência | Preço fixo R$ 15,90 para "Croissant Artesanal" (catálogo: R$ 16,50) | `aparencia/page.tsx` usa os produtos reais | E2E aparência sem erro | — |
| Tours guiados | Ausente | driver.js 1.10.2 (MIT, versão fixa), `src/lib/training/tours.ts`, `src/components/training/tour-runner.ts`, âncoras `data-tour` em 9 telas | `e2e/treinamento.spec.ts` (progresso, teclado, Esc, pular âncora ausente, persistência) | Progresso no navegador até ligar o banco |
| Central de treinamento | Ausente | `/painel/[slug]/treinamento`, `training-center.tsx`, `help-button.tsx`, `store-help.tsx`, menu "Central de treinamento", botão Ajuda em todas as telas do painel e no KDS | E2E: busca, filtros, todos os prints carregam, concluir/feedback | — |
| Prints reais | Ausente | `scripts/capture-training.ts` (Playwright + sharp, tenant demo, WhatsApp/ViaCEP bloqueados), 33 prints WebP, destaques medidos no elemento real | `tests/training.test.ts`: todo print citado existe, todo destaque existe no print, rotas/âncoras/guias válidos | — |
| Acessibilidade | 5 violações reais (contraste do vermelho de atraso, prévia do WhatsApp no escuro, botão Som com 42 px) — corrigidas na rodada anterior | — | axe-core WCAG 2.2 AA em 21 telas claro/escuro, toque ≥ 44 px, teclado: 27/27 | Leitor de tela e zoom 200% manuais |

## Cobertura do treinamento

- **12 artigos**, **8 tours**, **7 itens de checklist**, **33 prints reais** (`public/training/screenshots/1.0.0/`).
- 14 de 14 rotas de página com print (inclui estados: vazio, pedido novo, preparo, pagamento misto, troco, divisão, cupom, comanda, QR, produto pausado, Pix, acompanhamento, onboarding).
- Cobertura detalhada: `docs/training/COVERAGE.md`; manifesto: `docs/training/SCREENSHOT_MANIFEST.json`.
- Artigos que envolvem serviço externo exibem o aviso **Simulação** (Pix, gateways, Super Admin sem login).
- Central: `http://localhost:3000/painel/cafe-e-flor/treinamento` · produção após deploy: `https://comandazero.vercel.app/painel/cafe-e-flor/treinamento`.

## Jornada mesa → KDS → pagamento verificada (e o que é simulado)

`e2e/fluxos.spec.ts` cobre: cliente pede pelo cardápio (Pix com QR válido) → pedido chega no painel com notificação → KDS Começar/Pronto → status muda na tela do cliente; e separadamente mesa via QR (`?mesa=04`), comanda, transferência e fechamento.
**Simulado:** confirmação do Pix (botão de demonstração), sincronização entre aparelhos (só entre abas), estoque e relatório financeiro (não existem ainda).

## Problemas críticos

- **P0 aberto:** `/super-admin` e `/painel` sem autenticação; pedidos e cardápio só no navegador; webhook de pagamento sem assinatura.
- **Corrigidos nesta rodada:** rolagem lateral (5 telas), divergência de preço na prévia.
- **Corrigidos na rodada anterior:** gatilho de WhatsApp não disparava com o painel aberto; manifest duplicado na loja.

## Comandos e resultados

```
npm run typecheck            → 0 erros
npx eslint .                 → 0 problemas
npx vitest run               → 3 arquivos, 40 testes passando
npm run build                → ok (21 rotas)
npm run training:capture     → 33 prints, 0 pendentes
npx playwright test          → 65 passando, 0 falhas, 0 instáveis (139 s)
```
