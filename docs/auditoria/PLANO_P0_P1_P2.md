# Plano P0 / P1 / P2 · ComandaZero

Ordem pensada para a Café e Flor operar de verdade com mais de um aparelho. Cada item só é "pronto" com teste, tour, artigo e print (regra da central de treinamento).

## P0 · Base confiável (antes de qualquer loja real)

1. **Proteger `/super-admin` e `/painel` no servidor.** Hoje abrem sem login. Proxy + checagem de sessão Supabase; `super_admin` via tabela `platform_admins` (já criada). Teste: anônimo e lojista comum recebem redirecionamento/403.
2. **Pedidos no banco com Realtime.** Trocar a camada `src/lib/repositories` (contrato já isolado) por Supabase: criação de pedido por rota de servidor que recalcula preço a partir do banco (o navegador não define preço), número sequencial (trigger já existe), `track_token` para o cliente acompanhar de outro aparelho. KDS/painel assinam `orders` no Realtime (publicação já ativa).
3. **Papéis por loja** (`tenant_members.role` já existe): dono, gerente, caixa, garçom, cozinha. Ações sensíveis (cancelar, estornar, configurar integração) checadas no servidor.
4. **Cardápio e fotos no banco/Storage**, com política de upload (tipo, tamanho).
5. **Webhooks de pagamento com assinatura por gateway** e idempotência por `order_payments (gateway, external_id)` (índice único já existe). Nunca confirmar pagamento por clique em produção.
6. **Separar demo de produção**: loja demo isolada com flag; botão "Simular confirmação" só existe na demo.

## P1 · Rotina de cada operação

- Caixa por operador/turno: abertura com fundo, sangria, suprimento, fechamento com conferência por forma de pagamento.
- KDS por estação (bar, chapa, confeitaria) e tela de expedição que só libera com todos os itens prontos.
- Mesas: juntar/separar contas, divisão por itens, QR com token, PWA do garçom com PIN.
- Delivery: despacho, entregador (PWA), ocorrências.
- WhatsApp: inbox única por loja com handoff humano; robô lendo o cardápio do banco; dedupe persistente (`wa_messages` já existe).
- Pagamentos reais: começar por um gateway (Asaas ou Mercado Pago) em sandbox com webhook assinado; depois os demais.
- Fidelidade transacional no servidor.

## P2 · Expansão

- Estoque, fichas técnicas, compras, CMV.
- Modelos por segmento (pizzaria meio a meio, buffet por quilo, padaria com balança).
- NFC-e via provedor homologado (obrigatória no varejo em SP desde 01/01/2026); até lá o sistema só emite cupom **não fiscal** e diz isso.
- Totem/tablet de mesa, relatórios financeiros, DRE gerencial, Super Admin com billing real e feature flags.
- Observabilidade (logs estruturados, alertas), testes de carga (500 produtos, 50 pedidos simultâneos) com números medidos.
