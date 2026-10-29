// Tipos do painel, no formato em que as consultas devolvem (datas como texto ISO).

export type Status = "a_fazer" | "fazendo" | "em_revisao" | "feito";
export type PapelAtribuicao = "responsavel" | "apoio";
export type PapelPainel = "admin" | "membro" | "orientador";
export type Origem = "manual" | "reuniao" | "claude" | "contato" | "trello";
export type TipoDocumento = "roteiro" | "registro" | "sintese" | "entregavel" | "outro";
export type StatusSemana = "nao_iniciada" | "em_andamento" | "entregue";
export type StatusContato = "novo" | "em_conversa" | "respondido" | "arquivado";
export type PerfilContato = "produtor" | "fabricante" | "locadora" | "pesquisador" | "imprensa" | "outro";

export const STATUS: { valor: Status; rotulo: string }[] = [
  { valor: "a_fazer", rotulo: "A fazer" },
  { valor: "fazendo", rotulo: "Fazendo" },
  { valor: "em_revisao", rotulo: "Em revisão" },
  { valor: "feito", rotulo: "Feito" },
];
export const rotuloStatus = (s: Status) => STATUS.find((x) => x.valor === s)?.rotulo ?? s;

export const ORIGENS: Record<Origem, string> = {
  manual: "manual",
  reuniao: "reunião",
  claude: "Claude",
  contato: "contato do site",
  trello: "Trello",
};

export const TIPOS_DOCUMENTO: { valor: TipoDocumento; rotulo: string }[] = [
  { valor: "roteiro", rotulo: "roteiro" },
  { valor: "registro", rotulo: "registro" },
  { valor: "sintese", rotulo: "síntese" },
  { valor: "entregavel", rotulo: "entregável" },
  { valor: "outro", rotulo: "outro" },
];

export const STATUS_SEMANA: Record<StatusSemana, string> = {
  nao_iniciada: "não iniciada",
  em_andamento: "em andamento",
  entregue: "entregue",
};

export const STATUS_CONTATO: { valor: StatusContato; rotulo: string }[] = [
  { valor: "novo", rotulo: "novo" },
  { valor: "em_conversa", rotulo: "em conversa" },
  { valor: "respondido", rotulo: "respondido" },
  { valor: "arquivado", rotulo: "arquivado" },
];

export const PERFIS_CONTATO: Record<PerfilContato, string> = {
  produtor: "Produtor",
  fabricante: "Fabricante ou revenda",
  locadora: "Locadora de máquinas",
  pesquisador: "Pesquisador",
  imprensa: "Imprensa",
  outro: "Outro",
};

export type Pessoa = {
  id: string;
  nome: string;
  apelido: string | null;
  email: string;
  frente: string | null;
  papel: PapelPainel;
  cor: string;
  ativo: boolean;
  auth_id: string | null;
};

export type Semana = {
  id: string;
  numero: number;
  inicio: string; // YYYY-MM-DD
  fim: string;
  entrega_titulo: string | null;
  entrega_prazo: string | null;
  entrega_url: string | null;
  status: StatusSemana;
  anotacoes: string | null;
};

export type Etiqueta = { id: string; nome: string; token: string };

export type Item = { id: string; texto: string; feito: boolean };

export type Atribuicao = {
  id: string;
  pessoa_id: string;
  papel: PapelAtribuicao;
  itens: Item[];
};

export type TarefaResumo = {
  id: string;
  titulo: string;
  status: Status;
  posicao: number;
  prazo: string | null;
  ligada_entrega: boolean;
  origem: Origem;
  semana_id: string | null;
  semana: number | null;
  etiquetas: string[];
  atribuicoes: Atribuicao[];
  documentos: number;
  comentarios: number;
  concluido_em: string | null;
  criado_em: string;
};

export type Documento = {
  id: string;
  titulo: string;
  url: string;
  tipo: TipoDocumento;
  criado_em: string;
};

export type Comentario = {
  id: string;
  autor_id: string;
  texto: string;
  criado_em: string;
};

export type Historico = {
  id: number;
  autor_id: string | null;
  via_api: boolean;
  acao: string;
  detalhe: Record<string, unknown> | null;
  criado_em: string;
};

export type TarefaCompleta = TarefaResumo & {
  descricao: string | null;
  criado_por: string | null;
  reuniao_id: string | null;
  contato_id: string | null;
  arquivada: boolean;
  lista_documentos: Documento[];
  lista_comentarios: Comentario[];
  historico: Historico[];
};

export type Reuniao = {
  id: string;
  data: string;
  anotacoes: string | null;
  ata_url: string | null;
  presentes: string[];
  decisoes: { id: string; texto: string }[];
};

export type Contato = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  perfil: PerfilContato;
  cidade_uf: string | null;
  area_ha: number | null;
  tipo_colheita: string | null;
  mensagem: string;
  status: StatusContato;
  responsavel_id: string | null;
  notas: string | null;
  criado_em: string;
  tarefa_id: string | null;
};

export type Configuracao = {
  reuniao_dia_semana: number | null;
  reuniao_hora: string | null;
  responsavel_contato_id: string | null;
};

export type TokenApi = {
  id: string;
  nome: string;
  criado_em: string;
  ultimo_uso: string | null;
  revogado: boolean;
};

export type Resultado<T = undefined> = { ok: true; dado?: T } | { ok: false; erro: string };
