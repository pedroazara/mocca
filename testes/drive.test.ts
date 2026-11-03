// Aba Arquivos: links do Drive, a árvore da pasta e a leitura pela API do Google
// com uma conta de serviço. O Google é simulado; a consulta dos links roda num
// Postgres embutido com as migrações e o seed.

import { PGlite } from "@electric-sql/pglite";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Consulta } from "@/lib/banco";
import {
  buscarNaArvore,
  caminhoAte,
  idDaPasta,
  idDoDrive,
  indexar,
  ordenar,
  recentes,
  tamanhoLegivel,
  tipoPeloMime,
  usosPorArquivo,
  type ItemDrive,
  type LinkDoPainel,
} from "@/lib/drive/arvore";
import { arvoreDeExemplo } from "@/lib/drive/exemplo";

vi.mock("server-only", () => ({}));

const { API_ARQUIVOS, ESCOPO, LIMITE_ITENS, URL_TOKEN, assinarJwt, esquecerArvore, estadoDoDrive, lerConfig, paraTela } = await import("@/lib/drive");
const { linksDoDrive } = await import("@/lib/painel/arquivos");

// ids com cara de id do Drive (os de verdade não vão para o repositório)
const ID = {
  raiz: "1RaizDoProjetoAbCdEfGhIjKlMnOpQ",
  semanas: "1PastaSemanasAbCdEfGhIjKlMnOpQ",
  semana2: "1PastaSemana2AbCdEfGhIjKlMnOpQ",
  pitch: "1PastaPitchAbCdEfGhIjKlMnOpQrS",
  roteiro: "1DocRoteiroAbCdEfGhIjKlMnOpQrStUvWxYz",
  planilha: "1PlanilhaAbCdEfGhIjKlMnOpQrStUvWxYz0",
  pdf: "1PdfMedidasAbCdEfGhIjKlMnOpQ",
  atalho: "1AtalhoAbCdEfGhIjKlMnOpQrStU",
  foraDaPasta: "1ForaDaPastaAbCdEfGhIjKlMnOpQ",
};

describe("links do Drive", () => {
  it("acha o id em todos os formatos de link", () => {
    const casos: [string, string | null][] = [
      [`https://docs.google.com/document/d/${ID.roteiro}/edit?usp=sharing`, ID.roteiro],
      [`https://docs.google.com/spreadsheets/u/0/d/${ID.planilha}/edit#gid=0`, ID.planilha],
      [`https://docs.google.com/presentation/d/${ID.roteiro}/present`, ID.roteiro],
      [`https://drive.google.com/file/d/${ID.pdf}/view?usp=drive_link`, ID.pdf],
      [`https://drive.google.com/drive/folders/${ID.raiz}`, ID.raiz],
      [`https://drive.google.com/drive/u/1/folders/${ID.raiz}?resourcekey=0-abc`, ID.raiz],
      [`https://drive.google.com/open?id=${ID.pdf}`, ID.pdf],
      [`https://drive.google.com/uc?id=${ID.pdf}&export=download`, ID.pdf],
      ["https://docs.google.com/document/d/exemplo-roteiro", "exemplo-roteiro"],
      // formulário publicado: o id do link não é o do arquivo
      ["https://docs.google.com/forms/d/e/1FAIpQLSeAbCdEfGhIjKlMn/viewform", null],
      [`https://example.com/document/d/${ID.roteiro}`, null],
      [`http://drive.google.com/file/d/${ID.pdf}/view`, null],
      ["https://drive.google.com/drive/my-drive", null],
      ["não é link", null],
      ["", null],
    ];
    for (const [url, id] of casos) expect(idDoDrive(url), url).toBe(id);
    expect(idDoDrive(null)).toBeNull();
  });

  it("aceita a pasta pelo link ou só pelo id", () => {
    expect(idDaPasta(ID.raiz)).toBe(ID.raiz);
    expect(idDaPasta(` https://drive.google.com/drive/folders/${ID.raiz}?usp=sharing `)).toBe(ID.raiz);
    expect(idDaPasta("pasta do projeto")).toBeNull();
    expect(idDaPasta(undefined)).toBeNull();
  });

  it("dá o tipo pelo MIME, com os formatos do Office junto dos do Google", () => {
    expect(tipoPeloMime("application/vnd.google-apps.folder")).toBe("pasta");
    expect(tipoPeloMime("application/vnd.google-apps.document")).toBe("documento");
    expect(tipoPeloMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("documento");
    expect(tipoPeloMime("application/vnd.google-apps.spreadsheet")).toBe("planilha");
    expect(tipoPeloMime("text/csv")).toBe("planilha");
    expect(tipoPeloMime("application/vnd.ms-powerpoint")).toBe("apresentacao");
    expect(tipoPeloMime("application/pdf")).toBe("pdf");
    expect(tipoPeloMime("image/jpeg")).toBe("imagem");
    expect(tipoPeloMime("video/mp4")).toBe("video");
    expect(tipoPeloMime("audio/mpeg")).toBe("audio");
    expect(tipoPeloMime("application/zip")).toBe("compactado");
    expect(tipoPeloMime("text/plain")).toBe("documento");
    expect(tipoPeloMime("application/octet-stream")).toBe("outro");
  });
});

const item = (id: string, nome: string, pai: string, extra: Partial<ItemDrive> = {}): ItemDrive => ({
  id,
  nome,
  tipo: "documento",
  pai,
  link: `https://drive.google.com/open?id=${id}`,
  modificado: null,
  por: null,
  tamanho: null,
  ...extra,
});

describe("árvore da pasta", () => {
  const itens = [
    item("a", "Semana 10", "raiz", { tipo: "pasta" }),
    item("b", "Semana 2", "raiz", { tipo: "pasta" }),
    item("c", "Ata.pdf", "raiz", { tipo: "pdf", modificado: "2026-11-01T10:00:00.000Z" }),
    item("d", "Roteiro de Entrevista", "b", { modificado: "2026-11-02T10:00:00.000Z" }),
    item("e", "Síntese das entrevistas", "b", { modificado: "2026-10-30T10:00:00.000Z" }),
    item("f", "Áudios", "b", { tipo: "pasta" }),
    item("g", "entrevista-1.m4a", "f", { tipo: "audio", modificado: "2026-11-03T10:00:00.000Z" }),
    item("h", "Atalho para pasta", "raiz", { tipo: "pasta", alvo: "fora" }),
  ];

  it("põe as pastas primeiro e ordena os números como números", () => {
    expect(ordenar(itens.filter((i) => i.pai === "raiz")).map((i) => i.nome)).toEqual(["Semana 2", "Semana 10", "Ata.pdf", "Atalho para pasta"]);
    const { filhos } = indexar(itens);
    expect(filhos.get("b")?.map((i) => i.nome)).toEqual(["Áudios", "Roteiro de Entrevista", "Síntese das entrevistas"]);
  });

  it("monta o caminho da raiz até a pasta", () => {
    const indice = indexar(itens);
    expect(caminhoAte(indice, "f").map((i) => i.nome)).toEqual(["Semana 2", "Áudios"]);
    expect(caminhoAte(indice, "raiz")).toEqual([]);
    expect(caminhoAte(indice, "não existe")).toEqual([]);
  });

  it("busca em todas as pastas, sem acento nem maiúscula, com todas as palavras", () => {
    // em ordem de nome: entrevista-1.m4a, Roteiro de Entrevista, Síntese das entrevistas
    expect(buscarNaArvore(itens, "entrevista").itens.map((i) => i.id)).toEqual(["g", "d", "e"]);
    expect(buscarNaArvore(itens, "SINTESE entrevistas").itens.map((i) => i.id)).toEqual(["e"]);
    expect(buscarNaArvore(itens, "audios").itens.map((i) => i.id)).toEqual(["f"]);
    expect(buscarNaArvore(itens, "   ").total).toBe(0);
    expect(buscarNaArvore(itens, "entrevista", 2)).toMatchObject({ total: 3, itens: [{ id: "g" }, { id: "d" }] });
  });

  it("lista os recentes sem as pastas, do mais novo para o mais velho", () => {
    expect(recentes(itens).map((i) => i.id)).toEqual(["g", "d", "c", "e"]);
    expect(recentes(itens, 2).map((i) => i.id)).toEqual(["g", "d"]);
  });

  it("escreve o tamanho do arquivo", () => {
    expect(tamanhoLegivel(512)).toBe("512 B");
    expect(tamanhoLegivel(1536)).toBe("1,5 KB");
    expect(tamanhoLegivel(482_304)).toBe("471 KB");
    expect(tamanhoLegivel(48_211_000)).toBe("46 MB");
    expect(tamanhoLegivel(3 * 1024 ** 3)).toBe("3 GB");
  });

  it("a pasta de exemplo do modo local é uma árvore só, com os documentos do seed-dev", () => {
    const exemplo = arvoreDeExemplo(Date.parse("2026-11-03T12:00:00Z"));
    const ids = new Set([exemplo.raiz.id, ...exemplo.itens.map((i) => i.id)]);
    expect(ids.size).toBe(exemplo.itens.length + 1);
    for (const i of exemplo.itens) expect(ids.has(i.pai), i.nome).toBe(true);
    const seed = readFileSync(join(__dirname, "..", "supabase", "seed-dev.sql"), "utf8");
    for (const url of seed.match(/https:\/\/docs\.google\.com\/[^']+/g) ?? []) expect(ids.has(idDoDrive(url)!), url).toBe(true);
  });
});

describe("onde cada arquivo aparece no painel", () => {
  const itens = [
    item(ID.roteiro, "Roteiro", ID.semana2),
    item(ID.planilha, "Registro", ID.semana2, { tipo: "planilha" }),
    item(ID.atalho, "Atalho para o roteiro", ID.pitch, { alvo: ID.roteiro }),
  ];
  const link = (url: string, onde: LinkDoPainel["onde"], ref: string, titulo: string | null = null, data: string | null = null): LinkDoPainel => ({
    url,
    onde,
    ref,
    titulo,
    data,
  });

  it("junta tarefas, semanas, entregas e atas, uma vez por página", () => {
    const usos = usosPorArquivo(
      [
        link(`https://docs.google.com/document/d/${ID.roteiro}/edit`, "tarefa", "t1", "Entrevistas"),
        link(`https://docs.google.com/document/d/${ID.roteiro}/edit?usp=sharing`, "tarefa", "t1", "Entrevistas"),
        link(`https://docs.google.com/document/d/${ID.roteiro}`, "semana", "2", "Roteiro"),
        link(`https://docs.google.com/document/d/${ID.roteiro}`, "entrega", "2", "Pacote da semana 2"),
        link(`https://drive.google.com/open?id=${ID.planilha}`, "ata", "r1", null, "2026-10-29T22:00:00.000Z"),
        link(`https://docs.google.com/document/d/${ID.foraDaPasta}`, "tarefa", "t2", "Outra"),
      ],
      itens,
    );
    // a entrega vem antes do documento da mesma semana, e fica no lugar dele
    expect(usos[ID.roteiro]).toEqual([
      { href: "/painel/semanas/2", rotulo: "Entrega da semana 2" },
      { href: "/painel/tarefas/t1", rotulo: "Entrevistas" },
    ]);
    expect(usos[ID.planilha]).toEqual([{ href: "/painel/reunioes/r1", rotulo: "Ata de 29/10" }]);
    // o atalho mostra onde o arquivo de destino aparece
    expect(usos[ID.atalho]).toEqual(usos[ID.roteiro]);
    expect(Object.keys(usos)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------- Google simulado

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const chavePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const CONTA = "painel-mocca@projeto-teste.iam.gserviceaccount.com";
const json = JSON.stringify({ type: "service_account", client_email: CONTA, private_key: chavePem, token_uri: URL_TOKEN });
const ENV = { GOOGLE_DRIVE_FOLDER: `https://drive.google.com/drive/folders/${ID.raiz}`, GOOGLE_SERVICE_ACCOUNT_KEY: json };

type Arquivo = {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  lastModifyingUser?: { displayName?: string; emailAddress?: string };
  shortcutDetails?: { targetId: string; targetMimeType: string };
};

const PASTA = "application/vnd.google-apps.folder";
const DOC = "application/vnd.google-apps.document";

const DRIVE: Arquivo[] = [
  { id: ID.semanas, name: "atividades-semanais", mimeType: PASTA, parents: [ID.raiz] },
  { id: ID.pitch, name: "pitch", mimeType: PASTA, parents: [ID.raiz] },
  {
    id: ID.semana2,
    name: "SEMANA 2",
    mimeType: PASTA,
    parents: [ID.semanas],
  },
  {
    id: ID.roteiro,
    name: "Roteiro das entrevistas",
    mimeType: DOC,
    parents: [ID.semana2],
    modifiedTime: "2026-11-02T13:00:00.000Z",
    size: "12805",
    webViewLink: `https://docs.google.com/document/d/${ID.roteiro}/edit?usp=drivesdk`,
    lastModifyingUser: { displayName: "GABRIEL LEONARDO DA SILVA", emailAddress: "Gabriel.Leonardo@exemplo.com" },
  },
  {
    id: ID.pdf,
    name: "Medidas do tubo.pdf",
    mimeType: "application/pdf",
    parents: [ID.semana2],
    modifiedTime: "2026-11-01T13:00:00.000Z",
    size: "482304",
    webViewLink: `https://drive.google.com/file/d/${ID.pdf}/view?usp=drivesdk`,
    lastModifyingUser: { displayName: "Mentor de fora" },
  },
  {
    id: ID.atalho,
    name: "Pasta de outra equipe",
    mimeType: "application/vnd.google-apps.shortcut",
    parents: [ID.pitch],
    shortcutDetails: { targetId: ID.foraDaPasta, targetMimeType: PASTA },
  },
];

type Chamada = { url: URL; metodo: string; corpo?: string; autorizacao?: string };

function googleFalso(opcoes: { arquivos?: Arquivo[]; raiz?: Partial<Arquivo> & { driveId?: string }; porPagina?: number; responder?: (c: Chamada) => Response | undefined } = {}) {
  const chamadas: Chamada[] = [];
  const arquivos = opcoes.arquivos ?? DRIVE;
  const porPagina = opcoes.porPagina ?? 1000;
  const buscar = vi.fn(async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(entrada));
    const c: Chamada = {
      url,
      metodo: init?.method ?? "GET",
      corpo: init?.body ? String(init.body) : undefined,
      autorizacao: new Headers(init?.headers).get("authorization") ?? undefined,
    };
    chamadas.push(c);
    const pronta = opcoes.responder?.(c);
    if (pronta) return pronta;
    if (url.href === URL_TOKEN) return Response.json({ access_token: "token-de-teste", expires_in: 3600, token_type: "Bearer" });
    if (url.pathname === `/drive/v3/files/${ID.raiz}`)
      return Response.json({ id: ID.raiz, name: "avanca-cafe", mimeType: PASTA, webViewLink: `https://drive.google.com/drive/folders/${ID.raiz}`, ...opcoes.raiz });
    if (url.pathname === "/drive/v3/files") {
      const pais = [...(url.searchParams.get("q") ?? "").matchAll(/'([\w-]+)' in parents/g)].map((m) => m[1]);
      const todos = arquivos.filter((a) => a.parents.some((p) => pais.includes(p)));
      const inicio = Number(url.searchParams.get("pageToken") ?? 0);
      const pagina = todos.slice(inicio, inicio + porPagina);
      return Response.json({ files: pagina, ...(inicio + porPagina < todos.length ? { nextPageToken: String(inicio + porPagina) } : {}) });
    }
    return Response.json({ error: { code: 404, message: "Not found" } }, { status: 404 });
  });
  const listas = () => chamadas.filter((c) => c.url.pathname === "/drive/v3/files");
  return { buscar: buscar as unknown as typeof fetch, chamadas, listas };
}

const erroGoogle = (status: number, reason: string, message = "erro") =>
  Response.json({ error: { code: status, message, status: reason.toUpperCase(), errors: [{ reason, message }] } }, { status });

beforeEach(() => {
  esquecerArvore();
  delete (globalThis as { __moccaDriveToken?: unknown }).__moccaDriveToken;
});

describe("configuração do Drive", () => {
  it("lê o JSON da chave puro ou em base64, e a pasta pelo link", () => {
    expect(lerConfig(ENV).config).toEqual({ pastaId: ID.raiz, conta: { email: CONTA, chave: chavePem } });
    const base64 = Buffer.from(json).toString("base64");
    expect(lerConfig({ ...ENV, GOOGLE_SERVICE_ACCOUNT_KEY: base64 }).config?.conta.email).toBe(CONTA);
    // chave colada com "\n" literal
    const umaLinha = JSON.stringify({ client_email: CONTA, private_key: chavePem.replace(/\n/g, "\\n") });
    expect(lerConfig({ ...ENV, GOOGLE_SERVICE_ACCOUNT_KEY: umaLinha }).config?.conta.chave).toBe(chavePem);
  });

  it("diz o que falta e o que está errado", () => {
    expect(lerConfig({})).toEqual({ falta: ["GOOGLE_DRIVE_FOLDER", "GOOGLE_SERVICE_ACCOUNT_KEY"], erro: undefined, conta: undefined });
    expect(lerConfig({ GOOGLE_SERVICE_ACCOUNT_KEY: json })).toMatchObject({ falta: ["GOOGLE_DRIVE_FOLDER"], conta: CONTA });
    expect(lerConfig({ ...ENV, GOOGLE_SERVICE_ACCOUNT_KEY: '{"chave": 1}' }).erro).toMatch(/GOOGLE_SERVICE_ACCOUNT_KEY/);
    expect(lerConfig({ ...ENV, GOOGLE_DRIVE_FOLDER: "a pasta do projeto" }).erro).toMatch(/GOOGLE_DRIVE_FOLDER/);
  });

  it("assina o JWT com a chave da conta de serviço, só para ler metadados", () => {
    const jwt = assinarJwt({ email: CONTA, chave: chavePem }, Date.parse("2026-11-03T12:00:00Z"));
    const [cabecalho, corpo, assinatura] = jwt.split(".");
    const ler = (parte: string) => JSON.parse(Buffer.from(parte, "base64url").toString());
    expect(ler(cabecalho)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(ler(corpo)).toEqual({ iss: CONTA, scope: ESCOPO, aud: URL_TOKEN, iat: 1793707200, exp: 1793710800 });
    expect(ESCOPO).toBe("https://www.googleapis.com/auth/drive.metadata.readonly");
    expect(createVerify("RSA-SHA256").update(`${cabecalho}.${corpo}`).verify(publicKey, assinatura, "base64url")).toBe(true);
  });
});

describe("leitura da pasta pela API do Drive", () => {
  it("lê a pasta inteira com uma consulta por nível e monta os itens", async () => {
    const google = googleFalso({ porPagina: 1 });
    const estado = await estadoDoDrive({ env: ENV, buscar: google.buscar, exemploLocal: false });
    if (estado.estado !== "ok") throw new Error(JSON.stringify(estado));

    // token pedido com o JWT, e usado em todas as chamadas da API
    const token = google.chamadas[0];
    expect(token.metodo).toBe("POST");
    expect(new URLSearchParams(token.corpo).get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(google.chamadas.slice(1).every((c) => c.autorizacao === "Bearer token-de-teste")).toBe(true);

    // nível 1: a raiz; nível 2: atividades-semanais e pitch juntas; nível 3: SEMANA 2.
    // Com uma página por item, cada nível pede as páginas seguintes.
    const consultas = google.listas().map((c) => c.url.searchParams.get("q"));
    expect(new Set(consultas)).toEqual(
      new Set([
        `('${ID.raiz}' in parents) and trashed = false`,
        `('${ID.semanas}' in parents or '${ID.pitch}' in parents) and trashed = false`,
        `('${ID.semana2}' in parents) and trashed = false`,
      ]),
    );
    expect(google.listas()).toHaveLength(6);
    expect(google.listas().every((c) => c.url.href.startsWith(`${API_ARQUIVOS}?`))).toBe(true);
    expect(google.listas()[0].url.searchParams.get("supportsAllDrives")).toBe("true");

    const { raiz, itens, incompleta } = estado.arvore;
    expect(raiz).toEqual({ id: ID.raiz, nome: "avanca-cafe", link: `https://drive.google.com/drive/folders/${ID.raiz}` });
    expect(incompleta).toBe(false);
    expect(itens.map((i) => i.id).sort()).toEqual(DRIVE.map((a) => a.id).sort());
    const porId = new Map(itens.map((i) => [i.id, i]));
    expect(porId.get(ID.roteiro)).toEqual({
      id: ID.roteiro,
      nome: "Roteiro das entrevistas",
      tipo: "documento",
      pai: ID.semana2,
      link: `https://docs.google.com/document/d/${ID.roteiro}/edit?usp=drivesdk`,
      modificado: "2026-11-02T13:00:00.000Z",
      por: "GABRIEL LEONARDO DA SILVA",
      porEmail: "gabriel.leonardo@exemplo.com",
      // documento do Google não tem tamanho que interesse
      tamanho: null,
    });
    expect(porId.get(ID.pdf)).toMatchObject({ tipo: "pdf", tamanho: 482304, por: "Mentor de fora" });
    expect(porId.get(ID.pdf)).not.toHaveProperty("porEmail");
    // atalho: abre o destino no Drive, e a leitura não entra nele
    expect(porId.get(ID.atalho)).toMatchObject({ tipo: "pasta", alvo: ID.foraDaPasta, link: `https://drive.google.com/open?id=${ID.foraDaPasta}` });
    expect(consultas.join(" ")).not.toContain(ID.foraDaPasta);
  });

  it("guarda a árvore por um minuto, e o Atualizar lê de novo sem pedir outro token", async () => {
    const google = googleFalso();
    const opcoes = { env: ENV, buscar: google.buscar, exemploLocal: false };
    await estadoDoDrive(opcoes);
    const depoisDaPrimeira = google.chamadas.length;
    await estadoDoDrive(opcoes);
    expect(google.chamadas.length).toBe(depoisDaPrimeira);

    esquecerArvore();
    await estadoDoDrive(opcoes);
    const novas = google.chamadas.slice(depoisDaPrimeira);
    expect(novas.length).toBeGreaterThan(0);
    expect(novas.some((c) => c.url.href === URL_TOKEN)).toBe(false);
  });

  it("com muitas pastas no mesmo nível, divide a consulta em lotes de até 25", async () => {
    const pastas = Array.from({ length: 30 }, (_, i) => ({
      id: `1Pasta${String(i).padStart(3, "0")}AbCdEfGhIj`,
      name: `Semana ${i + 1}`,
      mimeType: PASTA,
      parents: [ID.raiz],
    }));
    const arquivos = pastas.map((p, i) => ({ id: `1Doc${String(i).padStart(3, "0")}AbCdEfGhIjKl`, name: `Ata ${i + 1}`, mimeType: DOC, parents: [p.id] }));
    const google = googleFalso({ arquivos: [...pastas, ...arquivos] });
    const estado = await estadoDoDrive({ env: ENV, buscar: google.buscar, exemploLocal: false });
    const clausulas = google.listas().map((c) => (c.url.searchParams.get("q")?.match(/in parents/g) ?? []).length);
    expect(clausulas).toEqual([1, 25, 5]);
    expect(estado.estado === "ok" && estado.arvore.itens.length).toBe(60);
  });

  it("só aceita link https do Google; senão, monta o link pelo id", async () => {
    const google = googleFalso({
      arquivos: [{ id: ID.pdf, name: "Estranho.pdf", mimeType: "application/pdf", parents: [ID.raiz], webViewLink: "javascript:alert(1)" }],
    });
    const estado = await estadoDoDrive({ env: ENV, buscar: google.buscar, exemploLocal: false });
    expect(estado.estado === "ok" && estado.arvore.itens[0].link).toBe(`https://drive.google.com/open?id=${ID.pdf}`);
  });

  it("pasta num drive compartilhado: busca dentro daquele drive", async () => {
    const google = googleFalso({ raiz: { driveId: "0AdriveCompartilhado" } });
    await estadoDoDrive({ env: ENV, buscar: google.buscar, exemploLocal: false });
    for (const c of google.listas()) {
      expect(c.url.searchParams.get("corpora")).toBe("drive");
      expect(c.url.searchParams.get("driveId")).toBe("0AdriveCompartilhado");
      expect(c.url.searchParams.get("includeItemsFromAllDrives")).toBe("true");
    }
  });

  it("para de ler quando passa do limite de itens e avisa", async () => {
    const muitos = Array.from({ length: LIMITE_ITENS + 10 }, (_, i) => ({
      id: `1Arquivo${String(i).padStart(6, "0")}AbCdEf`,
      name: `Foto ${i}.jpg`,
      mimeType: "image/jpeg",
      parents: [ID.raiz],
    }));
    const google = googleFalso({ arquivos: muitos });
    const estado = await estadoDoDrive({ env: ENV, buscar: google.buscar, exemploLocal: false });
    expect(estado.estado === "ok" && estado.arvore.incompleta).toBe(true);
    expect(estado.estado === "ok" && estado.arvore.itens.length).toBe(LIMITE_ITENS);
  });

  it("explica cada erro do Google, sem guardar o erro no cache", async () => {
    const casos: [Partial<Record<"token" | "raiz", Response>>, RegExp][] = [
      [{ raiz: erroGoogle(404, "notFound", `File not found: ${ID.raiz}.`) }, /não foi encontrada, ou não está compartilhada/],
      [{ raiz: erroGoogle(403, "accessNotConfigured", "Google Drive API has not been used in project") }, /Google Drive API não está ativada/],
      [{ raiz: erroGoogle(403, "insufficientFilePermissions") }, /recusou o acesso/],
      [{ raiz: erroGoogle(429, "rateLimitExceeded") }, /pediu uma pausa/],
      [{ token: Response.json({ error: "invalid_grant", error_description: "Invalid JWT Signature." }, { status: 400 }) }, /recusou a chave/],
      [{ raiz: Response.json({ id: ID.raiz, name: "Ata", mimeType: DOC }) }, /é de um arquivo, e não de uma pasta/],
    ];
    for (const [respostas, mensagem] of casos) {
      esquecerArvore();
      delete (globalThis as { __moccaDriveToken?: unknown }).__moccaDriveToken;
      const google = googleFalso({
        responder: (c) => (c.url.href === URL_TOKEN ? respostas.token : c.url.pathname.endsWith(ID.raiz) ? respostas.raiz?.clone() : undefined),
      });
      const estado = await estadoDoDrive({ env: ENV, buscar: google.buscar, exemploLocal: false });
      expect(estado, String(mensagem)).toMatchObject({ estado: "erro", mensagem: expect.stringMatching(mensagem), conta: CONTA });
    }

    // o detalhe técnico guarda a resposta do Google, para o admin
    const google = googleFalso({ responder: (c) => (c.url.pathname.endsWith(ID.raiz) ? erroGoogle(404, "notFound", "File not found.") : undefined) });
    const estado = await estadoDoDrive({ env: ENV, buscar: google.buscar, exemploLocal: false });
    expect(estado).toMatchObject({ detalhe: "404 NOTFOUND notFound File not found." });

    // na visita seguinte, tenta de novo
    const antes = google.chamadas.length;
    await estadoDoDrive({ env: ENV, buscar: google.buscar, exemploLocal: false });
    expect(google.chamadas.length).toBeGreaterThan(antes);
  });

  it("sem rede, avisa sem quebrar a página", async () => {
    const buscar = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await estadoDoDrive({ env: ENV, buscar, exemploLocal: false })).toMatchObject({
      estado: "erro",
      mensagem: expect.stringMatching(/Não foi possível falar com o Google Drive/),
      detalhe: "TypeError: fetch failed",
    });
  });

  it("sem as variáveis: exemplo no modo local, aviso fora dele", async () => {
    const buscar = vi.fn() as unknown as typeof fetch;
    expect((await estadoDoDrive({ env: {}, buscar, exemploLocal: true })).estado).toBe("exemplo");
    expect(await estadoDoDrive({ env: {}, buscar, exemploLocal: false })).toEqual({
      estado: "sem_config",
      falta: ["GOOGLE_DRIVE_FOLDER", "GOOGLE_SERVICE_ACCOUNT_KEY"],
      conta: undefined,
    });
    // com uma das duas preenchida, mesmo no modo local, a tela diz o que falta
    expect(await estadoDoDrive({ env: { GOOGLE_SERVICE_ACCOUNT_KEY: json }, buscar, exemploLocal: true })).toMatchObject({
      estado: "sem_config",
      falta: ["GOOGLE_DRIVE_FOLDER"],
      conta: CONTA,
    });
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe("o que vai para a tela", () => {
  const equipe = [{ nome: "Gabriel Leonardo", email: "gabriel.leonardo@exemplo.com" }];

  it("troca o nome do Google pelo da equipe e não manda o e-mail", async () => {
    const google = googleFalso();
    const estado = paraTela(await estadoDoDrive({ env: ENV, buscar: google.buscar, exemploLocal: false }), { admin: false, equipe });
    if (estado.estado !== "ok") throw new Error(estado.estado);
    const porId = new Map(estado.arvore.itens.map((i) => [i.id, i]));
    expect(porId.get(ID.roteiro)?.por).toBe("Gabriel Leonardo");
    expect(porId.get(ID.pdf)?.por).toBe("Mentor de fora");
    expect(JSON.stringify(estado)).not.toContain("@");
  });

  it("detalhe técnico e conta de serviço só para o admin", () => {
    const erro = { estado: "erro" as const, mensagem: "A pasta não foi encontrada.", detalhe: "404 notFound", conta: CONTA };
    expect(paraTela(erro, { admin: true, equipe })).toEqual(erro);
    expect(paraTela(erro, { admin: false, equipe })).toEqual({ estado: "erro", mensagem: "A pasta não foi encontrada." });
    const semConfig = { estado: "sem_config" as const, falta: ["GOOGLE_DRIVE_FOLDER"], conta: CONTA };
    expect(paraTela(semConfig, { admin: false, equipe })).toEqual({ estado: "sem_config", falta: ["GOOGLE_DRIVE_FOLDER"] });
  });
});

// ---------------------------------------------------------------- links guardados no banco

describe("links do Drive no banco", () => {
  const pasta = join(__dirname, "..", "supabase");
  const ler = (...p: string[]) => readFileSync(join(pasta, ...p), "utf8");
  const db = new PGlite();
  const q = (async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows) as Consulta;

  beforeAll(async () => {
    await db.exec(ler("local", "auth-stub.sql"));
    for (const f of readdirSync(join(pasta, "migrations")).sort()) await db.exec(ler("migrations", f));
    await db.exec(ler("seed.sql"));
  });

  it("traz documentos de tarefas e semanas, entregáveis e atas, sem as tarefas arquivadas", async () => {
    const tarefa = async (titulo: string, arquivada = false) =>
      (await db.query<{ id: string }>("insert into tarefa (titulo, arquivada) values ($1, $2) returning id", [titulo, arquivada])).rows[0].id;
    const ativa = await tarefa("Entrevistas");
    const arquivada = await tarefa("Antiga", true);
    const doc = `https://docs.google.com/document/d/${ID.roteiro}/edit`;
    await db.query("insert into documento (tarefa_id, titulo, url) values ($1, 'Roteiro', $2), ($3, 'Velho', $2)", [ativa, doc, arquivada]);
    await db.query("insert into documento (semana_id, titulo, url) select id, 'Aula', $1 from semana where numero = 3", [
      `https://drive.google.com/file/d/${ID.pdf}/view`,
    ]);
    await db.query("update semana set entrega_url = $1 where numero = 2", [`https://drive.google.com/drive/folders/${ID.semana2}`]);
    const { rows } = await db.query<{ id: string }>("insert into reuniao (data, ata_url) values ('2026-10-29T22:00:00Z', $1) returning id", [
      `https://docs.google.com/document/d/${ID.planilha}`,
    ]);

    const links = await linksDoDrive(q);
    expect(links.map(({ data, ...l }) => ({ ...l, temData: data !== null })).sort((a, b) => a.onde.localeCompare(b.onde))).toEqual([
      { url: `https://docs.google.com/document/d/${ID.planilha}`, onde: "ata", ref: rows[0].id, titulo: null, temData: true },
      { url: `https://drive.google.com/drive/folders/${ID.semana2}`, onde: "entrega", ref: "2", titulo: expect.any(String), temData: false },
      { url: `https://drive.google.com/file/d/${ID.pdf}/view`, onde: "semana", ref: "3", titulo: "Aula", temData: false },
      { url: doc, onde: "tarefa", ref: ativa, titulo: "Entrevistas", temData: false },
    ]);
  });
});
