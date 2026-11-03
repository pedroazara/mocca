import "server-only";
import { createSign } from "node:crypto";
import { modoLocalPermitido } from "@/lib/banco";
import type { Pessoa } from "@/lib/painel/tipos";
import { idDaPasta, tipoPeloMime, type ArvoreDrive, type EstadoDrive, type ItemDrive } from "./arvore";
import { arvoreDeExemplo } from "./exemplo";

// Pasta do projeto no Google Drive (aba Arquivos). O servidor lê a pasta com uma
// conta de serviço do Google, que só enxerga o que foi compartilhado com ela, e
// só com a permissão de ler os metadados (nome, tipo, data, link), nunca o
// conteúdo. A árvore inteira vem numa consulta por nível de pastas e fica um
// minuto na memória do servidor; o botão Atualizar da tela lê de novo.
//
// GOOGLE_DRIVE_FOLDER: link ou id da pasta.
// GOOGLE_SERVICE_ACCOUNT_KEY: o JSON da chave da conta de serviço (puro ou em base64).

export const ESCOPO = "https://www.googleapis.com/auth/drive.metadata.readonly";
export const URL_TOKEN = "https://oauth2.googleapis.com/token";
export const API_ARQUIVOS = "https://www.googleapis.com/drive/v3/files";
const MIME_PASTA = "application/vnd.google-apps.folder";
const MIME_ATALHO = "application/vnd.google-apps.shortcut";
const CAMPOS =
  "id,name,mimeType,parents,modifiedTime,size,webViewLink," +
  "lastModifyingUser(displayName,emailAddress),shortcutDetails(targetId,targetMimeType)";

const PASTAS_POR_CONSULTA = 25; // consulta curta, longe dos limites de URL e de complexidade
export const LIMITE_ITENS = 5000;
const LIMITE_CHAMADAS = 100;
const VALIDADE_CACHE = 60_000;

export type Buscar = typeof fetch;
export type ContaServico = { email: string; chave: string };
export type ConfigDrive = { pastaId: string; conta: ContaServico };

// No servidor, o item guarda também o e-mail de quem mexeu por último, para
// trocar pelo nome da pessoa na equipe. O e-mail não vai para a tela.
export type ItemServidor = ItemDrive & { porEmail?: string };
export type EstadoServidor = EstadoDrive<ItemServidor>;

export class ErroDrive extends Error {
  constructor(
    mensagem: string,
    readonly detalhe?: string,
  ) {
    super(mensagem);
    this.name = "ErroDrive";
  }
}

// ---------------------------------------------------------------- configuração

function lerChave(bruta: string): ContaServico | null {
  try {
    const texto = bruta.startsWith("{") ? bruta : Buffer.from(bruta, "base64").toString("utf8");
    const j = JSON.parse(texto) as { client_email?: unknown; private_key?: unknown };
    if (typeof j.client_email !== "string" || typeof j.private_key !== "string") return null;
    // a chave colada numa linha só às vezes chega com "\n" literal
    const chave = j.private_key.replace(/\\n/g, "\n");
    return chave.includes("PRIVATE KEY") ? { email: j.client_email, chave } : null;
  } catch {
    return null;
  }
}

export function lerConfig(env: Record<string, string | undefined> = process.env): {
  config?: ConfigDrive;
  falta: string[];
  erro?: string;
  conta?: string;
} {
  const pasta = env.GOOGLE_DRIVE_FOLDER?.trim();
  const bruta = env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  const falta = [!pasta && "GOOGLE_DRIVE_FOLDER", !bruta && "GOOGLE_SERVICE_ACCOUNT_KEY"].filter(Boolean) as string[];
  const conta = bruta ? lerChave(bruta) : null;
  const pastaId = idDaPasta(pasta);
  const erro =
    bruta && !conta
      ? "A variável GOOGLE_SERVICE_ACCOUNT_KEY não tem o JSON de uma chave de conta de serviço do Google."
      : pasta && !pastaId
        ? "A variável GOOGLE_DRIVE_FOLDER não tem o link de uma pasta do Google Drive."
        : undefined;
  if (falta.length || erro || !conta || !pastaId) return { falta, erro, conta: conta?.email };
  return { config: { pastaId, conta }, falta };
}

// ---------------------------------------------------------------- token de acesso

// JWT assinado com a chave da conta de serviço (RS256), trocado por um token de
// acesso de 1 hora no Google.
export function assinarJwt(conta: ContaServico, agora = Date.now()) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const iat = Math.floor(agora / 1000);
  const corpo = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: conta.email, scope: ESCOPO, aud: URL_TOKEN, iat, exp: iat + 3600 })}`;
  return `${corpo}.${createSign("RSA-SHA256").update(corpo).sign(conta.chave, "base64url")}`;
}

type Token = { email: string; valor: string; expira: number };
type Global = typeof globalThis & {
  __moccaDriveToken?: Token;
  __moccaDrive?: { chave: string; quando: number; arvore: Promise<ArvoreDrive<ItemServidor>> };
};
const g = globalThis as Global;

async function tokenDeAcesso(conta: ContaServico, buscar: Buscar): Promise<string> {
  const atual = g.__moccaDriveToken;
  if (atual && atual.email === conta.email && atual.expira - Date.now() > 60_000) return atual.valor;
  let assertion: string;
  try {
    assertion = assinarJwt(conta);
  } catch (e) {
    throw new ErroDrive("A chave da conta de serviço não pôde ser lida. Gere uma chave nova no Google Cloud.", String(e));
  }
  const r = await buscar(URL_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!r.ok || !j.access_token) {
    throw new ErroDrive(
      "O Google recusou a chave da conta de serviço. Gere uma chave nova no Google Cloud.",
      `${r.status} ${j.error ?? ""} ${j.error_description ?? ""}`.replace(/\s+/g, " ").trim(),
    );
  }
  g.__moccaDriveToken = { email: conta.email, valor: j.access_token, expira: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

// ---------------------------------------------------------------- leitura da pasta

type ErroApi = { error?: { message?: string; status?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } };

async function erroDaApi(r: Response): Promise<ErroDrive> {
  const j = (await r.json().catch(() => null)) as ErroApi | null;
  const motivo = [j?.error?.status, ...(j?.error?.errors ?? []).map((e) => e.reason), ...(j?.error?.details ?? []).map((d) => d.reason)]
    .filter(Boolean)
    .join(" ");
  const detalhe = `${r.status} ${motivo} ${j?.error?.message ?? ""}`.replace(/\s+/g, " ").trim();
  if (/accessNotConfigured|SERVICE_DISABLED/.test(motivo))
    return new ErroDrive("A Google Drive API não está ativada no projeto do Google Cloud da conta de serviço.", detalhe);
  if (r.status === 429 || /rateLimit/i.test(motivo)) return new ErroDrive("O Google Drive pediu uma pausa. Tente de novo em um minuto.", detalhe);
  if (r.status === 404) return new ErroDrive("A pasta não foi encontrada, ou não está compartilhada com a conta de serviço do painel.", detalhe);
  if (r.status === 401 || r.status === 403)
    return new ErroDrive("O Google Drive recusou o acesso da conta de serviço do painel à pasta.", detalhe);
  return new ErroDrive("O Google Drive não respondeu como esperado. Tente de novo em instantes.", detalhe);
}

type ArquivoApi = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  driveId?: string;
  lastModifyingUser?: { displayName?: string; emailAddress?: string };
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
};

const linkAbrir = (id: string) => `https://drive.google.com/open?id=${id}`;
const idValido = (id: string) => /^[\w-]+$/.test(id);
// o link vem do Google, mas só entra na tela se for https
const linkSeguro = (link: string | undefined, id: string) => (link?.startsWith("https://") ? link : linkAbrir(id));

function paraItem(f: ArquivoApi, pai: string): ItemServidor {
  const alvo = f.mimeType === MIME_ATALHO ? f.shortcutDetails?.targetId : undefined;
  const mime = alvo ? (f.shortcutDetails?.targetMimeType ?? "") : f.mimeType;
  const email = f.lastModifyingUser?.emailAddress?.toLowerCase();
  return {
    id: f.id,
    nome: f.name,
    tipo: tipoPeloMime(mime),
    pai,
    link: alvo ? linkAbrir(alvo) : linkSeguro(f.webViewLink, f.id),
    modificado: f.modifiedTime ?? null,
    por: f.lastModifyingUser?.displayName ?? null,
    tamanho: !alvo && f.size && !mime.startsWith("application/vnd.google-apps.") ? Number(f.size) : null,
    ...(alvo ? { alvo } : {}),
    ...(email ? { porEmail: email } : {}),
  };
}

// Lê a pasta e tudo o que está dentro dela, nível por nível: cada consulta pede
// os filhos de até 25 pastas de uma vez ('a' in parents or 'b' in parents...).
export async function lerArvore(config: ConfigDrive, buscar: Buscar = fetch): Promise<ArvoreDrive<ItemServidor>> {
  const token = await tokenDeAcesso(config.conta, buscar);
  const chamar = async <T>(url: string): Promise<T> => {
    const r = await buscar(url, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (r.status === 401) g.__moccaDriveToken = undefined;
    if (!r.ok) throw await erroDaApi(r);
    return (await r.json()) as T;
  };

  const raiz = await chamar<ArquivoApi>(
    `${API_ARQUIVOS}/${encodeURIComponent(config.pastaId)}?${new URLSearchParams({ fields: "id,name,mimeType,webViewLink,driveId", supportsAllDrives: "true" })}`,
  );
  if (raiz.mimeType !== MIME_PASTA) throw new ErroDrive("O link em GOOGLE_DRIVE_FOLDER é de um arquivo, e não de uma pasta.");

  // pasta num drive compartilhado: a busca precisa ser dentro daquele drive
  const base: Record<string, string> = {
    fields: `nextPageToken,files(${CAMPOS})`,
    pageSize: "1000",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    ...(raiz.driveId ? { corpora: "drive", driveId: raiz.driveId } : {}),
  };

  const itens: ItemServidor[] = [];
  const vistos = new Set([raiz.id]);
  let chamadas = 0;
  let incompleta = false;

  const filhosDe = async (pais: string[]) => {
    const achados: { arquivo: ArquivoApi; pai: string }[] = [];
    const q = `(${pais.map((id) => `'${id}' in parents`).join(" or ")}) and trashed = false`;
    let pagina: string | undefined;
    do {
      if (++chamadas > LIMITE_CHAMADAS) {
        incompleta = true;
        break;
      }
      const r = await chamar<{ files?: ArquivoApi[]; nextPageToken?: string }>(
        `${API_ARQUIVOS}?${new URLSearchParams({ ...base, q, ...(pagina ? { pageToken: pagina } : {}) })}`,
      );
      for (const arquivo of r.files ?? []) achados.push({ arquivo, pai: arquivo.parents?.find((p) => pais.includes(p)) ?? pais[0] });
      pagina = r.nextPageToken;
    } while (pagina);
    return achados;
  };

  let nivel = [raiz.id];
  while (nivel.length && !incompleta) {
    const lotes: string[][] = [];
    for (let i = 0; i < nivel.length; i += PASTAS_POR_CONSULTA) lotes.push(nivel.slice(i, i + PASTAS_POR_CONSULTA));
    const achados = (await Promise.all(lotes.map(filhosDe))).flat();
    nivel = [];
    for (const { arquivo, pai } of achados) {
      if (vistos.has(arquivo.id) || !idValido(arquivo.id)) continue;
      if (itens.length >= LIMITE_ITENS) {
        incompleta = true;
        break;
      }
      vistos.add(arquivo.id);
      const item = paraItem(arquivo, pai);
      itens.push(item);
      if (item.tipo === "pasta" && !item.alvo) nivel.push(item.id);
    }
  }

  return {
    raiz: { id: raiz.id, nome: raiz.name, link: linkSeguro(raiz.webViewLink, raiz.id) },
    itens,
    lidaEm: new Date().toISOString(),
    incompleta,
  };
}

// ---------------------------------------------------------------- estado para a tela

function arvoreEmCache(config: ConfigDrive, buscar: Buscar) {
  const chave = `${config.conta.email}|${config.pastaId}`;
  const atual = g.__moccaDrive;
  if (atual && atual.chave === chave && Date.now() - atual.quando < VALIDADE_CACHE) return atual.arvore;
  const arvore = lerArvore(config, buscar);
  g.__moccaDrive = { chave, quando: Date.now(), arvore };
  // erro não fica no cache: a próxima visita tenta de novo
  arvore.catch(() => {
    if (g.__moccaDrive?.arvore === arvore) g.__moccaDrive = undefined;
  });
  return arvore;
}

// O botão Atualizar: a próxima leitura vai ao Drive.
export function esquecerArvore() {
  g.__moccaDrive = undefined;
}

// Nunca lança: o que der errado vira um estado que a tela explica. No modo local,
// sem nenhuma das duas variáveis, a tela mostra uma pasta de exemplo.
export async function estadoDoDrive({
  env = process.env,
  buscar = fetch,
  exemploLocal = modoLocalPermitido,
}: { env?: Record<string, string | undefined>; buscar?: Buscar; exemploLocal?: boolean } = {}): Promise<EstadoServidor> {
  const { config, falta, erro, conta } = lerConfig(env);
  if (!config) {
    if (erro) return { estado: "erro", mensagem: erro, conta };
    if (exemploLocal && falta.length === 2) return { estado: "exemplo", arvore: arvoreDeExemplo() };
    return { estado: "sem_config", falta, conta };
  }
  try {
    return { estado: "ok", arvore: await arvoreEmCache(config, buscar) };
  } catch (e) {
    if (e instanceof ErroDrive) return { estado: "erro", mensagem: e.message, detalhe: e.detalhe, conta: config.conta.email };
    console.error("[drive]", e);
    return {
      estado: "erro",
      mensagem: "Não foi possível falar com o Google Drive agora. Tente de novo em instantes.",
      detalhe: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      conta: config.conta.email,
    };
  }
}

// O que vai para a tela: quem mexeu no arquivo aparece com o nome que tem na
// equipe (pelo e-mail, que não sai do servidor), e os detalhes técnicos e o
// e-mail da conta de serviço ficam só para o admin.
export function paraTela(
  e: EstadoServidor,
  { admin, equipe }: { admin: boolean; equipe: Pick<Pessoa, "email" | "nome">[] },
): EstadoDrive {
  if (e.estado === "ok" || e.estado === "exemplo") {
    const nomes = new Map(equipe.map((p) => [p.email.toLowerCase(), p.nome]));
    const itens = e.arvore.itens.map(({ porEmail, ...i }) => ({ ...i, por: (porEmail && nomes.get(porEmail)) || i.por }));
    return { estado: e.estado, arvore: { ...e.arvore, itens } };
  }
  if (admin) return e;
  return e.estado === "erro" ? { estado: "erro", mensagem: e.mensagem } : { estado: "sem_config", falta: e.falta };
}
