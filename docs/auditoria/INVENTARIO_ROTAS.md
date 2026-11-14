# Inventário de rotas · ComandaZero

Auditoria de 14/11/2026, branch `auditoria-e-treinamento`, a partir do commit `6d1edd0` (produção).
Evidência de tela: `docs/auditoria/baseline.json` (gerado por `e2e/baseline.spec.ts`): 15 rotas × 3 tamanhos (1440×900, 1024×768, 390×844) = **45 combinações, 0 com erro de console, erro de rede, elemento sem nome ou rolagem lateral** após as correções desta rodada.

Legenda de status: `REAL/TESTADO` funciona e tem teste automatizado · `MOCK/DEMONSTRAÇÃO` funciona com dados ou serviço simulado · `PARCIAL` · `AUSENTE` · `NÃO VERIFICADO`.

## Páginas

| Rota | Quem usa | PWA | Depende de | Status | Problemas encontrados | Prioridade / ação |
|---|---|---|---|---|---|---|
| `/` | Público | SaaS (manifest só em `/painel`) | — | REAL/TESTADO | Nenhum | — |
| `/entrar` | Lojista | — | Supabase Auth | PARCIAL | Login funciona contra o Supabase, mas o painel **não exige** sessão | P0: proteger `/painel` e `/super-admin` no servidor |
| `/loja/[slug]` | Cliente final | Loja (manifest próprio, escopo `/loja/<slug>`) | Dados no navegador | MOCK/DEMONSTRAÇÃO | Cardápio lido do `localStorage`, não do Supabase | P0: ler cardápio do banco (RLS pública já testada) |
| `/loja/[slug]?mesa=07` | Cliente na mesa | Loja | — | MOCK/DEMONSTRAÇÃO | Número da mesa vem só da URL (sem token) | P1: QR com token não previsível |
| `/loja/[slug]/pedido/[id]` | Cliente | Loja | Dados no navegador | MOCK/DEMONSTRAÇÃO | Só abre no mesmo navegador que fez o pedido | P0: buscar por `get_order_tracking(id, token)` (função já existe no banco) |
| `/painel` | Lojista | SaaS | — | REAL/TESTADO | Redireciona fixo para `cafe-e-flor` | P0: redirecionar para a loja da sessão |
| `/painel/[slug]` | Proprietário | SaaS | Dados no navegador | MOCK/DEMONSTRAÇÃO | Números do dashboard são do histórico demo | P0 junto com pedidos no banco |
| `/painel/[slug]/pedidos` | Caixa, atendente | SaaS | BroadcastChannel | MOCK/DEMONSTRAÇÃO | Tempo real só entre abas do mesmo navegador | P0: Supabase Realtime |
| `/painel/[slug]/pdv` | Caixa | SaaS | — | REAL/TESTADO (local) | Sem abertura/fechamento de caixa por operador | P1: sessão de caixa |
| `/painel/[slug]/mesas` | Garçom | SaaS | — | REAL/TESTADO (local) | Sem juntar/separar contas, sem PWA do garçom | P1 |
| `/painel/[slug]/kds` | Cozinha | SaaS | BroadcastChannel | REAL/TESTADO (local) | Uma estação só; sem expedição | P1: estações e expedidor |
| `/painel/[slug]/cardapio` | Proprietário | SaaS | — | REAL/TESTADO (local) | Fotos enviadas ficam no `localStorage` (limite ~5 MB) | P0: Supabase Storage |
| `/painel/[slug]/fidelidade` | Proprietário | SaaS | — | REAL/TESTADO (local) | Selos calculados no navegador | P1: regra transacional no servidor |
| `/painel/[slug]/aparencia` | Proprietário | SaaS | — | REAL/TESTADO (local) | **Corrigido:** prévia mostrava “Croissant Artesanal R$ 15,90” fixo; catálogo tem Croissants Artesanais R$ 16,50. Agora usa os produtos reais | — |
| `/painel/[slug]/integracoes` | Proprietário, atendente | SaaS | Whaileys, Evolution, gateways | PARCIAL | WhatsApp Whaileys real (canal por loja); Evolution real se `EVOLUTION_API_*` configurado; pagamentos só montam payload (sandbox) | P1: cobrança real por gateway com webhook assinado |
| `/painel/[slug]/treinamento` | Toda a equipe | SaaS | — | REAL/TESTADO | Novo nesta rodada | — |
| `/super-admin` | Dono da plataforma | SaaS | Dados no navegador | MOCK/DEMONSTRAÇÃO | **Sem autenticação**: qualquer pessoa com o link abre. MRR calculado da demo | **P0 crítico** |

## APIs

| Rota | Função | Proteção | Status |
|---|---|---|---|
| `GET /api/manifest/[slug]` | Manifest PWA por loja / `saas` | Pública (sem dado sensível) | REAL/TESTADO |
| `GET /api/tenant-icon/[slug]` | Ícone PWA de loja sem ícone próprio | Pública | REAL |
| `POST /api/whatsapp/channel` | Conectar/status/logout do WhatsApp da loja | Código de ativação + selo AES-GCM + limite por IP | REAL/TESTADO (produção) |
| `POST /api/whatsapp/send` | Envio pelo número da loja | Selo do canal + limite por instância | REAL |
| `POST /api/whatsapp/evolution` | Provedor Evolution | Chaves só no servidor; 503 sem configuração | REAL (sem servidor Evolution configurado) |
| `POST /api/webhooks/whaileys` | Mensagens recebidas | HMAC + janela 5 min + dedupe por `key.id` | REAL/TESTADO (unitário) |
| `POST /api/webhooks/pagamentos/[gateway]` | Confirmação de pagamento | **Sem verificação de assinatura** | MOCK: só normaliza o evento |
