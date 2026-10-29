import { coresPessoas } from "./tokens";

export type Integrante = {
  nome: string;
  iniciais: string;
  curso: string;
  frase: string;
  cor: string;
  linkedin?: string;
};

// TODO(pedro): fotos e links do LinkedIn de cada pessoa (seção 6.5).
export const estudantes: Integrante[] = [
  {
    nome: "Gabriel Leonardo",
    iniciais: "GL",
    curso: "Engenharia Física",
    frase: "Coordena a estratégia do projeto e a conversa com produtores e parceiros.",
    cor: coresPessoas.gabriel,
  },
  {
    nome: "Pedro Henrique",
    iniciais: "PH",
    curso: "Engenharia Física",
    frase: "Cuida da parte técnica e da organização das tarefas da equipe.",
    cor: coresPessoas.pedro,
  },
  {
    nome: "Marcos Ferreira",
    iniciais: "MF",
    curso: "Engenharia Física",
    frase: "Cuida da divulgação e da identidade visual do MoCCa.",
    cor: coresPessoas.marcos,
  },
  {
    nome: "Lucas Pinotti",
    iniciais: "LP",
    curso: "Engenharia Física",
    frase: "Põe o protótipo para funcionar na prática e conduz os testes.",
    cor: coresPessoas.lucas,
  },
  {
    nome: "Henrique Perez",
    iniciais: "HP",
    curso: "Engenharia Mecânica",
    frase: "Projeta os protótipos e faz a modelagem 3D das peças.",
    cor: coresPessoas.henrique,
  },
];

export const orientador: Integrante = {
  nome: "Prof. Leomar Santos",
  iniciais: "LS",
  curso: "Departamento de Física, UFLA",
  frase: "Orienta a equipe no desenvolvimento do sistema de medição.",
  cor: coresPessoas.leomar,
};
