# Matriz de fluxos · ComandaZero

Cada linha é uma jornada completa. "Teste" aponta o teste automatizado que comprova o comportamento hoje.
Importante: **todo o estado de pedidos, mesas e cardápio vive no `localStorage` do navegador** (engine demo). O "tempo real" é `BroadcastChannel`: funciona entre abas do mesmo navegador, **não entre aparelhos**.

| Jornada | Status | Evidência | O que é simulado |
|---|---|---|---|
| Cliente: cardápio → opções/adicionais → carrinho → Pix → acompanhamento | MOCK/DEMONSTRAÇÃO | `e2e/fluxos.spec.ts` › produtos com foto e complementos; Pix com QR | Pix: BR Code válido (CRC16 testado), confirmação por botão "Simular confirmação do webhook" |
| Pedido do cliente chega no painel com som e notificação | REAL/TESTADO (mesmo navegador) | › Pix com QR … → painel → KDS | Sincronização entre aparelhos ausente |
| KDS: fila → preparando → pronto, status volta ao cliente | REAL/TESTADO (mesmo navegador) | › mesmo teste | — |
| Mesa via QR (`?mesa=04`) e pedir conta | REAL/TESTADO (local) | › mesa via QR | Mesa sem token de segurança |
| Encomenda de bolo: peso, frase, data mínima, sinal 50% via Pix | REAL/TESTADO (local) | › encomenda de bolo | Sinal via Pix simulado |
| Delivery: CEP (ViaCEP), bairro e taxa | REAL/TESTADO | › delivery com CEP (ViaCEP respondido localmente no teste) | — |
| PDV: F2 código, F4, pagamento misto, troco, cupom 58/80 mm | REAL/TESTADO (local) | › PDV: atalho F2… | Cupom não fiscal; sem caixa por operador |
| Mesas: abrir, lançar, transferir, QR para impressão | REAL/TESTADO (local) | › Mesas: abrir, lançar… | — |
| Pausar produto some da loja | REAL/TESTADO (mesmo navegador) | › Cardápio: pausar item | — |
| Gatilho WhatsApp "pedido recebido" com botões | REAL/TESTADO | › WhatsApp: gatilho de pedido | Envio interceptado no teste; em produção usa o canal real da loja |
| Robô do WhatsApp (menu, categoria, produto, atendente) | REAL/TESTADO (unitário) | `tests/whatsapp.test.ts` | Catálogo do robô vem da semente do servidor, não das edições do lojista |
| Webhook WhatsApp: assinatura, replay, dedupe, fromMe | REAL/TESTADO (unitário) | `tests/whatsapp.test.ts` | Dedupe em memória do servidor (perde em reinício) |
| Pagamento real por gateway | AUSENTE | — | Adaptadores montam a requisição oficial, nenhuma cobrança é feita |
| Super Admin: criar loja com cardápio modelo | REAL/TESTADO (local) | › Super Admin: cria tenant | Sem login; loja existe só no navegador |
| Login / cadastro / recuperar senha | PARCIAL | › Login: validação | Supabase Auth real; papéis e proteção de rotas ausentes |
| Isolamento entre lojas no banco (RLS) | REAL/TESTADO | Teste com chave anon contra o Supabase (relatório desta rodada) | App ainda não usa o banco |
| White-label: manifest e marca por loja | REAL/TESTADO | › white-label | — |
| Acessibilidade WCAG 2.2 AA | REAL/TESTADO | `e2e/acessibilidade.spec.ts` (axe em 21 telas claro/escuro, toque ≥ 44 px, teclado) | Leitor de tela e zoom 200% não testados manualmente |
| Tour guiado e central de treinamento | REAL/TESTADO | `e2e/treinamento.spec.ts`, `tests/training.test.ts` | Progresso no navegador (modo demo) |
| Offline | PARCIAL | `public/sw.js` + `offline.html` | Sem fila local; checkout exige conexão |
| Estoque/ficha técnica/CMV, caixa por turno, estações KDS, entregador, totem | AUSENTE | — | — |
