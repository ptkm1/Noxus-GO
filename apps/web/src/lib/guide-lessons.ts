/**
 * Videoaulas do Guia inicial.
 * Preencha `videoUrl` (YouTube/Vimeo/MP4) ou `externalUrl` quando o conteúdo estiver pronto.
 */
export type GuideLesson = {
  id: string;
  title: string;
  description: string;
  durationLabel: string;
  /** URL embutível (YouTube/Vimeo) ou arquivo de vídeo. */
  videoUrl?: string | null;
  /** Link externo (abre em nova aba) quando não houver embed. */
  externalUrl?: string | null;
};

export const GUIDE_LESSONS: GuideLesson[] = [
  {
    id: "primeiro-acesso",
    title: "Primeiros passos no Pedix Pro",
    description:
      "Tour rápido pelo painel: menu, estabelecimento ativo e como navegar entre as áreas principais.",
    durationLabel: "≈ 5 min",
    videoUrl: null,
  },
  {
    id: "produtos-estoque",
    title: "Cadastro de produtos e estoque",
    description:
      "Como criar produtos, categorias, preços e acompanhar movimentações de estoque.",
    durationLabel: "≈ 8 min",
    videoUrl: null,
  },
  {
    id: "clientes-pedidos",
    title: "Clientes e pedidos",
    description:
      "Cadastro de clientes, criação de pedidos e acompanhamento do status até a entrega.",
    durationLabel: "≈ 10 min",
    videoUrl: null,
  },
  {
    id: "vendedores-equipes",
    title: "Vendedores, equipes e visitas",
    description:
      "Gestão da força de vendas, líderes de equipe e visitas em campo.",
    durationLabel: "≈ 7 min",
    videoUrl: null,
  },
  {
    id: "expedicao-romaneio",
    title: "Expedição e romaneio de rota",
    description:
      "Separação de pedidos, conferência e montagem do romaneio para entrega.",
    durationLabel: "≈ 6 min",
    videoUrl: null,
  },
  {
    id: "financeiro-relatorios",
    title: "Financeiro, faturamento e relatórios",
    description:
      "Contas, faturamento e onde encontrar indicadores e relatórios do dia a dia.",
    durationLabel: "≈ 9 min",
    videoUrl: null,
  },
];
