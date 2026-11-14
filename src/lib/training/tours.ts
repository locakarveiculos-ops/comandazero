import type { ChecklistItem, Tour } from "./types";

// Tours guiados. Âncoras são atributos data-tour fixos nos componentes reais (não classes de estilo).
// Nenhum passo dispara ação: o tour só aponta e explica.
export const TOURS: Tour[] = [
  {
    id: "painel-visao-geral",
    version: 1,
    title: "Conhecer o painel",
    persona: "proprietario",
    route: "/painel/{slug}",
    steps: [
      { title: "Bem-vindo ao ComandaZero", text: "Em 1 minuto você vê onde fica cada coisa. Use as setas ou Tab para avançar e Esc para sair." },
      { anchor: "menu-lateral", side: "right", title: "Menu do painel", text: "Pedidos, PDV, mesas, cozinha, cardápio, fidelidade, marca do app e integrações. O número laranja em Pedidos mostra pedidos ainda não vistos." },
      { anchor: "dash-kpis", side: "bottom", title: "Números de hoje", text: "Faturamento, quantidade de pedidos, ticket médio e o que está em andamento agora." },
      { anchor: "som", side: "bottom", title: "Alerta sonoro", text: "Deixe ligado no computador do balcão: cada pedido novo toca um aviso. O navegador só libera o som depois do primeiro clique na página." },
      { title: "Pronto!", text: "Na Central de treinamento há um guia com prints para cada tela. Você pode refazer este tour pelo botão Ajuda a qualquer momento." },
    ],
  },
  {
    id: "pedidos-fila",
    version: 1,
    title: "Receber e acompanhar pedidos",
    persona: "proprietario",
    route: "/painel/{slug}/pedidos",
    steps: [
      { title: "Fila de pedidos", text: "Pedidos do cardápio, das mesas e do balcão chegam aqui na hora, piscando e com som." },
      { anchor: "pedidos-filtros", side: "bottom", title: "Filtros", text: "Em andamento, só encomendas ou todos. Encomendas mostram a data de retirada." },
      { title: "Avançar o pedido", text: "Cada cartão tem o próximo passo: Aceitar e preparar, Marcar pronto, Saiu para entrega ou Entregue. O cliente vê a mudança na tela de acompanhamento." },
    ],
  },
  {
    id: "pdv-venda",
    version: 1,
    title: "Venda rápida no balcão",
    persona: "caixa",
    route: "/painel/{slug}/pdv",
    steps: [
      { anchor: "pdv-busca", side: "bottom", title: "Busque ou digite o código", text: "F2 leva o cursor para cá. Digite o código (ex.: 101) e Enter lança o item direto." },
      { anchor: "pdv-categorias", side: "bottom", title: "Categorias", text: "Filtre a grade por categoria para achar mais rápido." },
      { anchor: "pdv-produtos", side: "right", title: "Toque no produto", text: "Um toque lança o item. Se o produto tiver escolha obrigatória (sabor, ponto), abre a janela de opções." },
      { anchor: "pdv-venda", side: "left", title: "Venda atual", text: "Ajuste quantidades com + e −. O total atualiza na hora." },
      { anchor: "pdv-finalizar", side: "top", title: "Finalizar (F4)", text: "Escolha a forma de pagamento, lance partes em formas diferentes ou divida por pessoa. Em dinheiro, o troco aparece em destaque." },
    ],
  },
  {
    id: "mesas-salao",
    version: 1,
    title: "Mesas e comandas",
    persona: "garcom",
    route: "/painel/{slug}/mesas",
    steps: [
      { anchor: "mesas-mapa", side: "top", title: "Mapa de mesas", text: "Verde é livre, azul ocupada e laranja pedindo a conta. O tempo mostra há quanto a mesa está aberta." },
      { title: "Abrir e lançar", text: "Toque numa mesa para abrir, lançar itens, transferir para outra mesa ou fechar a conta com serviço opcional de 10%." },
      { anchor: "mesas-qr", side: "bottom", title: "QR Code das mesas", text: "Imprima um QR por mesa. O cliente aponta a câmera e o pedido já chega com o número da mesa." },
    ],
  },
  {
    id: "kds-cozinha",
    version: 1,
    title: "Tela da cozinha (KDS)",
    persona: "cozinha",
    route: "/painel/{slug}/kds",
    steps: [
      { anchor: "kds-recebido", side: "right", title: "Fila", text: "Pedidos novos entram aqui, do mais antigo para o mais novo. Observações aparecem em destaque amarelo." },
      { anchor: "kds-preparo", side: "bottom", title: "Preparando", text: "Toque em Começar para trazer o pedido para cá. O cliente vê que o pedido está na cozinha." },
      { anchor: "kds-pronto", side: "left", title: "Pronto", text: "Pedido pronto para retirar ou entregar. A seta de voltar desfaz um toque errado." },
      { anchor: "kds-legenda", side: "bottom", title: "Cores do tempo", text: "Verde até 10 min, amarelo até 20 e vermelho acima. O tempo também aparece escrito no cartão." },
    ],
  },
  {
    id: "cardapio-gestao",
    version: 1,
    title: "Cardápio e estoque rápido",
    persona: "proprietario",
    route: "/painel/{slug}/cardapio",
    steps: [
      { anchor: "cardapio-novo", side: "bottom", title: "Novo produto", text: "Foto, nome, código do PDV, preço, categoria e grupos de complementos com mínimo e máximo." },
      { anchor: "cardapio-filtros", side: "bottom", title: "Filtrar", text: "Veja por categoria ou só os produtos pausados." },
      { anchor: "cardapio-lista", side: "top", title: "Esgotou? Pause", text: "A chave ao lado de cada produto tira o item do cardápio na hora, em todos os aparelhos. Ligue de novo quando voltar." },
    ],
  },
  {
    id: "integracoes-whatsapp",
    version: 1,
    title: "WhatsApp e pagamentos",
    persona: "atendente",
    route: "/painel/{slug}/integracoes",
    steps: [
      { anchor: "integ-abas", side: "bottom", title: "Integrações", text: "WhatsApp, pagamentos e e-mail ficam em abas separadas." },
      { title: "Conectar o WhatsApp", text: "Informe o código de ativação recebido da plataforma e leia o QR com o celular da loja (Aparelhos conectados). Nenhum token aparece na tela." },
      { title: "Testador de mensagens", text: "Veja como o cliente recebe os botões e listas antes de ativar os avisos automáticos." },
    ],
  },
  {
    id: "loja-cliente",
    version: 1,
    title: "Como o cliente pede",
    persona: "cliente",
    route: "/loja/{slug}",
    steps: [
      { anchor: "loja-modos", side: "bottom", title: "Como você quer receber", text: "Delivery, retirada no balcão ou encomenda. Pelo QR da mesa aparece também a opção Mesa." },
      { anchor: "loja-busca", side: "bottom", title: "Busque", text: "Digite o que procura ou toque numa categoria." },
      { anchor: "loja-destaques", side: "top", title: "Escolha e personalize", text: "Toque no produto para escolher opções e adicionais. O preço atualiza na hora." },
      { anchor: "loja-instalar", side: "bottom", title: "Instale o app da loja", text: "Fica na tela inicial do celular com o nome e o ícone da loja." },
    ],
  },
];

export const CHECKLIST: ChecklistItem[] = [
  { id: "marca", title: "Personalizar logo e cores do app", route: "/painel/{slug}/aparencia", roles: ["proprietario"], articleId: "aparencia-marca" },
  { id: "cardapio", title: "Revisar o cardápio e os preços", route: "/painel/{slug}/cardapio", roles: ["proprietario"], articleId: "cardapio-produto" },
  { id: "whatsapp", title: "Conectar o WhatsApp da loja", route: "/painel/{slug}/integracoes", roles: ["proprietario", "atendente"], articleId: "integracoes-whatsapp" },
  { id: "mesas", title: "Imprimir os QR Codes das mesas", route: "/painel/{slug}/mesas", roles: ["proprietario", "garcom"], articleId: "mesas-qr" },
  { id: "primeiro-pedido", title: "Fazer um pedido de teste no cardápio", route: "/loja/{slug}", roles: ["proprietario", "caixa"], articleId: "cliente-pedido" },
  { id: "kds", title: "Abrir o KDS no monitor da cozinha", route: "/painel/{slug}/kds", roles: ["proprietario", "cozinha"], articleId: "kds-fluxo" },
  { id: "pdv", title: "Fazer uma venda no PDV", route: "/painel/{slug}/pdv", roles: ["proprietario", "caixa"], articleId: "pdv-venda" },
];

export const tourById = (id: string) => TOURS.find((t) => t.id === id);
export const toursForRoute = (route: string) => TOURS.filter((t) => t.route === route);
