# Matriz de fluxos · ComandaZero

Atualizada em 14/11/2026 (branch `p0-producao`). Lojas reais usam o Supabase (pedidos, cardápio, fotos, Realtime).
As lojas de demonstração (`cafe-e-flor`, `burger-station`) seguem com dados no navegador e botões de simulação, marcadas como "Demonstração".

| Jornada | Status | Evidência | Observação |
|---|---|---|---|
| Cadastro → aceite dos Termos → onboarding em 5 passos → loja no ar | REAL/TESTADO | `e2e/auth.spec.ts` (aceite gravado com versão), `e2e/fluxos.spec.ts` › onboarding | Confirmação de e-mail desligada a pedido; religar com SMTP (`docs/PASSOS_MANUAIS.md`) |
| Link de e-mail (confirmação/recuperação) → `/auth/callback` | REAL/TESTADO | `e2e/auth.spec.ts` | Modelos PT-BR prontos em `supabase/templates/`; aplicar exige SMTP próprio |
| Recuperar senha → `/redefinir-senha` | REAL/TESTADO (sem sessão) | `e2e/auth.spec.ts` | Envio limitado a 2 e-mails/hora até configurar SMTP |
| Anônimo em painel de loja real ou Super Admin → `/entrar?next=` | REAL/TESTADO | `e2e/p0.spec.ts` | Demos continuam abertas para visitação |
| Logado sem vínculo → 403 | REAL/TESTADO | `e2e/p0.spec.ts` | — |
| Caixa vê PDV e não vê Cardápio, Equipe, Assinatura | REAL/TESTADO | `e2e/p0.spec.ts` | Bloqueio no servidor, não só no menu |
| Pedido no celular → KDS do tablet em < 3 s → cliente vê "Na cozinha" | REAL/TESTADO | `e2e/p0.spec.ts` (medido ~0,2 s) | Supabase Realtime com JWT |
| Preço adulterado / produto inexistente | REAL/TESTADO | `e2e/p0.spec.ts` (422) | Banco recalcula tudo |
| Webhook de pagamento: sem assinatura 401, válido 200, repetido sem efeito | REAL/TESTADO | `e2e/p0.spec.ts` | Mercado Pago testado; demais gateways seguem o mesmo verificador |
| Avaliação do cliente após entregue; média só com 10+ | REAL/TESTADO (banco) | validação SQL no `REPORT_P0.md` | Sem nota fictícia em loja real |
| Equipe: adicionar conta existente, trocar papel, remover | REAL/TESTADO | `e2e/p0.spec.ts` | Convite por e-mail depende do limite de e-mails |
| Assinatura: teste de 14 dias, aviso no painel, escolha de plano | REAL/TESTADO | `e2e/p0.spec.ts` | Cobrança Asaas ativa com `ASAAS_API_KEY` |
| Atraso > 7 dias → painel só leitura; pedidos seguem | REAL/TESTADO (banco) | validação SQL no `REPORT_P0.md` | — |
| Super Admin: dados reais, suspender/reativar com histórico | REAL/TESTADO | `e2e/p0.spec.ts` | — |
| Loja inexistente → 404; robots, sitemap, JSON-LD | REAL/TESTADO | `e2e/seo.spec.ts` | — |
| Landing: sem rolagem lateral em 1440/1024/390, alvos ≥ 44 px, sem erro de console | REAL/TESTADO | `e2e/landing.spec.ts` | — |
| PDV, mesas, fidelidade da loja real | PARCIAL | `e2e/fluxos.spec.ts` (demo) | Mesas e fidelidade ainda gravam no navegador para loja real (P1) |
| Pix dinâmico com confirmação automática para pedidos | AUSENTE em loja real | — | Loja real recebe pagamento presencial; aviso no checkout (`pix-presencial`) |
| Acessibilidade WCAG 2.2 AA | REAL/TESTADO | `e2e/acessibilidade.spec.ts` | Leitor de tela e zoom 200% não testados manualmente |
| Central de treinamento com prints reais | REAL/TESTADO | `tests/training.test.ts`, `e2e/treinamento.spec.ts` | Inclui Onboarding, Equipe, Assinatura e Avaliações |
