import { dataCurta } from "@/lib/painel/datas";
import { normalizar } from "@/lib/painel/trello";

// Pasta do projeto no Google Drive (aba Arquivos): o formato da árvore que o
// servidor monta e as regras puras que a tela usa para navegar, buscar e
// ordenar. Nada de servidor aqui, porque este arquivo também vai para o navegador.

export type TipoArquivo =
  | "pasta"
  | "documento"
  | "planilha"
  | "apresentacao"
  | "formulario"
  | "desenho"
  | "pdf"
  | "imagem"
  | "video"
  | "audio"
  | "compactado"
  | "outro";

export type ItemDrive = {
  id: string;
  nome: string;
  tipo: TipoArquivo;
  pai: string; // id da pasta onde o item está
  link: string; // abre no Drive
  modificado: string | null; // ISO
  por: string | null; // quem mexeu por último
  tamanho: number | null; // bytes; só arquivos enviados, não os do Google (Docs, Planilhas...)
  alvo?: string; // atalho do Drive: id do arquivo de destino, que pode estar fora da pasta
};

export type ArvoreDrive<I extends ItemDrive = ItemDrive> = {
  raiz: { id: string; nome: string; link: string };
  itens: I[];
  lidaEm: string;
  incompleta: boolean; // passou do limite de itens e parou de ler
};

export type EstadoDrive<I extends ItemDrive = ItemDrive> =
  | { estado: "ok"; arvore: ArvoreDrive<I> }
  | { estado: "exemplo"; arvore: ArvoreDrive<I> }
  | { estado: "sem_config"; falta: string[]; conta?: string }
  | { estado: "erro"; mensagem: string; detalhe?: string; conta?: string };

export const ROTULO_TIPO: Record<TipoArquivo, string> = {
  pasta: "Pasta",
  documento: "Documento",
  planilha: "Planilha",
  apresentacao: "Apresentação",
  formulario: "Formulário",
  desenho: "Desenho",
  pdf: "PDF",
  imagem: "Imagem",
  video: "Vídeo",
  audio: "Áudio",
  compactado: "Compactado",
  outro: "Arquivo",
};

const ID = "[\\w-]{10,}";
const ID_NO_CAMINHO = new RegExp(`/(?:d|folders)/(${ID})`);
const SO_ID = new RegExp(`^${ID}$`);

// Id do arquivo ou da pasta num link do Drive ou do Docs (/d/ID, /folders/ID,
// ?id=ID), ou null. Formulário publicado (/forms/d/e/...) não tem o id do arquivo.
export function idDoDrive(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !/^(drive|docs)\.google\.com$/.test(u.hostname)) return null;
  const doCaminho = u.pathname.match(ID_NO_CAMINHO);
  if (doCaminho) return doCaminho[1];
  const id = u.searchParams.get("id");
  return id && SO_ID.test(id) ? id : null;
}

// Link da pasta ou só o id dela (variável GOOGLE_DRIVE_FOLDER).
export function idDaPasta(valor: string | null | undefined): string | null {
  const v = valor?.trim();
  if (!v) return null;
  return SO_ID.test(v) ? v : idDoDrive(v);
}

const PELO_MIME: Record<string, TipoArquivo> = {
  "application/vnd.google-apps.folder": "pasta",
  "application/vnd.google-apps.document": "documento",
  "application/vnd.google-apps.spreadsheet": "planilha",
  "application/vnd.google-apps.presentation": "apresentacao",
  "application/vnd.google-apps.form": "formulario",
  "application/vnd.google-apps.drawing": "desenho",
  "application/pdf": "pdf",
  "application/msword": "documento",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "documento",
  "application/vnd.oasis.opendocument.text": "documento",
  "application/rtf": "documento",
  "application/vnd.ms-excel": "planilha",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "planilha",
  "application/vnd.oasis.opendocument.spreadsheet": "planilha",
  "text/csv": "planilha",
  "application/vnd.ms-powerpoint": "apresentacao",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "apresentacao",
  "application/vnd.oasis.opendocument.presentation": "apresentacao",
  "application/zip": "compactado",
  "application/x-zip-compressed": "compactado",
  "application/vnd.rar": "compactado",
  "application/x-rar-compressed": "compactado",
  "application/x-7z-compressed": "compactado",
  "application/gzip": "compactado",
  "application/x-tar": "compactado",
};

export function tipoPeloMime(mime: string): TipoArquivo {
  const tipo = PELO_MIME[mime];
  if (tipo) return tipo;
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("text/")) return "documento";
  return "outro";
}

// Pasta que abre aqui no painel. Um atalho para pasta abre no Drive, porque o
// destino pode estar fora da pasta do projeto.
export const ehPasta = (i: ItemDrive) => i.tipo === "pasta" && !i.alvo;

const colacao = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

// Pastas primeiro, depois por nome, com "Semana 2" antes de "Semana 10".
export function ordenar<I extends ItemDrive>(itens: I[]): I[] {
  return [...itens].sort((a, b) => Number(ehPasta(b)) - Number(ehPasta(a)) || colacao.compare(a.nome, b.nome));
}

export type IndiceDrive = { porId: Map<string, ItemDrive>; filhos: Map<string, ItemDrive[]> };

export function indexar(itens: ItemDrive[]): IndiceDrive {
  const porId = new Map(itens.map((i) => [i.id, i]));
  const filhos = new Map<string, ItemDrive[]>();
  for (const i of itens) {
    const lista = filhos.get(i.pai);
    if (lista) lista.push(i);
    else filhos.set(i.pai, [i]);
  }
  for (const [pai, lista] of filhos) filhos.set(pai, ordenar(lista));
  return { porId, filhos };
}

// Pastas entre a raiz (que não entra) e o item, nessa ordem, terminando nele.
export function caminhoAte(indice: IndiceDrive, id: string): ItemDrive[] {
  const caminho: ItemDrive[] = [];
  for (let atual = indice.porId.get(id); atual && caminho.length < 64; atual = indice.porId.get(atual.pai)) {
    caminho.unshift(atual);
  }
  return caminho;
}

// Busca pelo nome em todas as pastas, sem diferenciar maiúsculas nem acentos.
// Todas as palavras precisam aparecer, em qualquer ordem.
export function buscarNaArvore<I extends ItemDrive>(itens: I[], termo: string, limite = 50) {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return { itens: [] as I[], total: 0 };
  const achados = itens.filter((i) => {
    const nome = normalizar(i.nome);
    return palavras.every((p) => nome.includes(p));
  });
  return { itens: ordenar(achados).slice(0, limite), total: achados.length };
}

// Os arquivos modificados por último, de todas as pastas.
export function recentes<I extends ItemDrive>(itens: I[], limite = 30): I[] {
  return itens
    .filter((i) => i.tipo !== "pasta" && i.modificado)
    .sort((a, b) => Date.parse(b.modificado!) - Date.parse(a.modificado!))
    .slice(0, limite);
}

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function tamanhoLegivel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ["KB", "MB", "GB", "TB"];
  let valor = bytes / 1024;
  let u = 0;
  while (valor >= 1024 && u < unidades.length - 1) {
    valor /= 1024;
    u++;
  }
  return `${numero.format(valor)} ${unidades[u]}`;
}

// ---------------------------------------------------------------- onde aparece no painel

// Um link do Drive guardado no painel: documento de tarefa ou de semana, link do
// entregável da semana ou ata de reunião.
export type LinkDoPainel = {
  url: string;
  onde: "entrega" | "tarefa" | "semana" | "ata";
  ref: string; // id da tarefa ou da reunião, ou número da semana
  titulo: string | null;
  data: string | null; // data da reunião, nas atas
};

export type Uso = { href: string; rotulo: string };

const PRIORIDADE: Record<LinkDoPainel["onde"], number> = { entrega: 0, tarefa: 1, semana: 2, ata: 3 };

function paraUso(l: LinkDoPainel): Uso {
  switch (l.onde) {
    case "tarefa":
      return { href: `/painel/tarefas/${l.ref}`, rotulo: l.titulo || "Tarefa" };
    case "entrega":
      return { href: `/painel/semanas/${l.ref}`, rotulo: `Entrega da semana ${l.ref}` };
    case "semana":
      return { href: `/painel/semanas/${l.ref}`, rotulo: `Semana ${l.ref}` };
    case "ata":
      return { href: `/painel/reunioes/${l.ref}`, rotulo: l.data ? `Ata de ${dataCurta(l.data)}` : "Ata de reunião" };
  }
}

// Para cada item da árvore, onde o arquivo aparece no painel. Atalhos contam
// pelo arquivo de destino. Cada página aparece uma vez por arquivo.
export function usosPorArquivo(links: LinkDoPainel[], itens: ItemDrive[]): Record<string, Uso[]> {
  const itensDoArquivo = new Map<string, string[]>();
  for (const i of itens) {
    const arquivo = i.alvo ?? i.id;
    itensDoArquivo.set(arquivo, [...(itensDoArquivo.get(arquivo) ?? []), i.id]);
  }
  const usos: Record<string, Uso[]> = {};
  for (const l of [...links].sort((a, b) => PRIORIDADE[a.onde] - PRIORIDADE[b.onde])) {
    const id = idDoDrive(l.url);
    const alvos = id ? itensDoArquivo.get(id) : undefined;
    if (!alvos) continue;
    const uso = paraUso(l);
    for (const item of alvos) {
      const lista = (usos[item] ??= []);
      if (!lista.some((u) => u.href === uso.href)) lista.push(uso);
    }
  }
  return usos;
}
