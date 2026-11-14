// Contrato do conteúdo de treinamento (artigos, tours e checklist). Validado em tests/training.test.ts.

export type Persona = "proprietario" | "caixa" | "garcom" | "cozinha" | "atendente" | "cliente" | "super-admin";
export type Level = "basico" | "intermediario" | "avancado";

/** Destaque desenhado sobre o print real, em coordenadas relativas (0–1) da imagem. */
export type Highlight = { x: number; y: number; w: number; h: number; label?: string };
/** Destaque por âncora data-tour: o script de captura mede a posição real do elemento no print. */
export type HighlightRef = { anchor: string; label?: string };

export type TrainingStep = {
  text: string;
  /** Print do estado depois deste passo (gerado por scripts/capture-training.ts). */
  screenshot?: string;
  alt?: string;
  highlight?: HighlightRef[];
};

export type Article = {
  id: string;
  /** Rota com {slug} no lugar da loja. */
  route: string;
  module: string;
  roles: Persona[];
  level: Level;
  title: string;
  summary: string;
  prerequisites: string[];
  estimatedMinutes: number;
  steps: TrainingStep[];
  expectedResult: string;
  commonErrors: { problem: string; solution: string }[];
  warning?: string;
  /** Recurso depende de serviço externo: o artigo deixa claro o que é simulação. */
  simulation?: string;
  relatedGuides: string[];
  tourId?: string;
  version: string;
  updatedAt: string;
};

export type TourStep = {
  /** Valor de data-tour do elemento; sem âncora, o passo aparece centralizado. */
  anchor?: string;
  title: string;
  text: string;
  side?: "top" | "right" | "bottom" | "left";
};

export type Tour = {
  id: string;
  version: number;
  title: string;
  persona: Persona;
  /** Rota onde o tour roda (com {slug}). */
  route: string;
  steps: TourStep[];
};

export type ChecklistItem = { id: string; title: string; route: string; roles: Persona[]; articleId?: string };
