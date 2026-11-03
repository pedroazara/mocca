import type { ArvoreDrive, ItemDrive, TipoArquivo } from "./arvore";

// Pasta fictícia da aba Arquivos no modo local, quando o Drive não está ligado.
// Os ids exemplo-roteiro, exemplo-registro, exemplo-pacote-1 e exemplo-canvas
// são os dos documentos de supabase/seed-dev.sql, então a tela mostra em que
// tarefa cada um está.

const RAIZ = "exemplo-pasta-mocca";

export function arvoreDeExemplo(agora = Date.now()): ArvoreDrive {
  const ha = (horas: number) => new Date(agora - horas * 3_600_000).toISOString();
  const pasta = (id: string, nome: string, pai = RAIZ): ItemDrive => ({
    id,
    nome,
    tipo: "pasta",
    pai,
    link: `https://drive.google.com/drive/folders/${id}`,
    modificado: null,
    por: null,
    tamanho: null,
  });
  const arquivo = (
    id: string,
    nome: string,
    tipo: TipoArquivo,
    pai: string,
    horas: number,
    por: string,
    tamanho: number | null = null,
  ): ItemDrive => ({ id, nome, tipo, pai, link: `https://drive.google.com/open?id=${id}`, modificado: ha(horas), por, tamanho });

  return {
    raiz: { id: RAIZ, nome: "MoCCa (exemplo)", link: `https://drive.google.com/drive/folders/${RAIZ}` },
    itens: [
      pasta("exemplo-semanas", "atividades-semanais"),
      pasta("exemplo-semana-1", "Semana 1", "exemplo-semanas"),
      pasta("exemplo-semana-2", "Semana 2", "exemplo-semanas"),
      pasta("exemplo-semana-3", "Semana 3", "exemplo-semanas"),
      pasta("exemplo-mentorias", "Mentorias"),
      pasta("exemplo-pesquisas", "Pesquisas"),
      pasta("exemplo-pitch", "Pitch"),
      arquivo("exemplo-pacote-1", "Pacote de Tarefas Semana 1", "documento", "exemplo-semana-1", 200, "Pedro Henrique"),
      arquivo("exemplo-roteiro", "Roteiro das entrevistas", "documento", "exemplo-semana-2", 30, "Gabriel Leonardo"),
      arquivo("exemplo-registro", "Planilha de registro", "planilha", "exemplo-semana-2", 5, "Marcos Ferreira"),
      arquivo("exemplo-mentoria-negocio", "Anotações da mentoria de negócio", "documento", "exemplo-mentorias", 80, "Pedro Henrique"),
      arquivo("exemplo-medidas-tubo", "Medidas do tubo de saída.pdf", "pdf", "exemplo-pesquisas", 52, "Henrique Perez", 482_304),
      arquivo("exemplo-foto-bancada", "Bancada de testes.jpg", "imagem", "exemplo-pesquisas", 26, "Lucas Pinotti", 2_340_112),
      arquivo("exemplo-levantamento", "Levantamento de colhedoras", "planilha", "exemplo-pesquisas", 120, "Gabriel Leonardo"),
      arquivo("exemplo-canvas", "Canvas MoCCa", "apresentacao", "exemplo-pitch", 74, "Gabriel Leonardo"),
      arquivo("exemplo-video-pitch", "Ensaio do pitch.mp4", "video", "exemplo-pitch", 98, "Marcos Ferreira", 48_211_000),
      arquivo("exemplo-modelo-doc", "Modelo de documento", "documento", RAIZ, 300, "Pedro Henrique"),
    ],
    lidaEm: new Date(agora).toISOString(),
    incompleta: false,
  };
}
