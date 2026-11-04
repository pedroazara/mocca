import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextResponse } from "next/server";
import { z } from "zod";
import * as api from "@/lib/api/servico";

// Servidor MCP do painel (seção 11.3), no transporte HTTP "streamable" do MCP,
// sem sessão (cada requisição é independente) e com o mesmo token da API.
// Toda ferramenta que escreve só cria uma proposta, que espera a aprovação de um
// admin em /painel/aprovacoes (seção 11.4), e devolve o link dela.

export const dynamic = "force-dynamic";

const STATUS = z.enum(["a_fazer", "fazendo", "em_revisao", "feito"]);
const SO_DEPOIS = "Só vale depois que um admin aprovar no painel.";

function resultado(dado: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(dado, null, 2) }] };
}

async function executar(fn: () => Promise<unknown>) {
  try {
    return resultado(await fn());
  } catch (e) {
    if (e instanceof api.ErroApi)
      return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ erro: { codigo: e.codigo, mensagem: e.message, ...e.extra } }, null, 2) }] };
    console.error("[mcp]", e);
    return { isError: true, content: [{ type: "text" as const, text: "Erro interno no painel." }] };
  }
}

function criarServidor(tokenId: string) {
  const s = new McpServer(
    { name: "mocca-painel", version: "1.0.0" },
    {
      instructions:
        "Painel de tarefas da equipe MoCCa (UFLA, programa Avança Café). Use para propor tarefas depois das reuniões, " +
        "já atribuídas e com itens por pessoa. Leituras respondem na hora. Toda escrita vira uma proposta pendente e nada " +
        "muda no painel até um admin aprovar: diga que pediu, nunca que fez, e acompanhe com listar_propostas. " +
        "Tarefa nova ainda não tem id, então atribuições, itens e documentos vão dentro de criar_tarefa. " +
        "Pessoas podem ser indicadas por id, e-mail ou apelido (ex.: Gabriel, Pinotti). " +
        "Status: a_fazer, fazendo, em_revisao, feito. Semanas do programa: 1 a 12. Escreva em português do Brasil.",
    },
  );

  s.registerTool(
    "listar_pessoas",
    { title: "Listar pessoas", description: "Lista as pessoas ativas da equipe (id, nome, apelido, frente, e-mail)." },
    () => executar(() => api.listarPessoas()),
  );

  s.registerTool(
    "listar_semanas",
    {
      title: "Listar semanas",
      description: "Lista as 12 semanas do programa Avança Café com datas e a entrega de cada uma. Use apenas_atual para só a semana de hoje.",
      inputSchema: { apenas_atual: z.boolean().optional() },
    },
    ({ apenas_atual }) => executar(() => api.listarSemanas(Boolean(apenas_atual))),
  );

  s.registerTool(
    "listar_tarefas",
    {
      title: "Listar tarefas",
      description: "Lista tarefas resumidas, com filtros opcionais por semana (1 a 12), pessoa (id, e-mail ou apelido), status e atrasadas.",
      inputSchema: {
        semana: z.number().int().min(1).max(12).optional(),
        pessoa: z.string().optional(),
        status: STATUS.optional(),
        atrasadas: z.boolean().optional(),
      },
    },
    (f) => executar(() => api.listarTarefas(f)),
  );

  s.registerTool(
    "ver_tarefa",
    { title: "Ver tarefa", description: "Mostra a tarefa completa: atribuições, itens de cada pessoa, documentos e comentários.", inputSchema: { id: z.string() } },
    ({ id }) => executar(() => api.verTarefa(id)),
  );

  s.registerTool(
    "criar_tarefa",
    {
      title: "Criar tarefa",
      description:
        `Propõe uma tarefa com atribuições, itens por pessoa e documentos numa só operação. ${SO_DEPOIS} Até lá ela não tem id: ` +
        "coloque tudo aqui, sem chamar atribuir ou adicionar_documento depois. Exemplo de atribuicoes: " +
        '[{"pessoa":"Gabriel","papel":"responsavel","itens":["Agendar 3 produtores"]},{"pessoa":"Marcos","papel":"apoio","itens":["Preencher a planilha"]}]. ' +
        "Sem prazo, vale o fim da semana. Etiquetas: Entregas, Validação do Produto, Técnico, Negócio, Marketing. Use origem 'reuniao' se veio da reunião.",
      inputSchema: api.esquemaNovaTarefa.shape,
    },
    (corpo) => executar(() => api.criarTarefa(api.validar(api.esquemaNovaTarefa, corpo), tokenId)),
  );

  s.registerTool(
    "atualizar_tarefa",
    {
      title: "Atualizar tarefa",
      description: `Propõe mudar título, descrição, status, prazo, semana, etiquetas ou a ligação com a entrega. ${SO_DEPOIS} Envie só o que muda; etiquetas substitui a lista inteira. Mudar só a semana leva o prazo junto, se ele caía na semana antiga.`,
      inputSchema: { id: z.string(), ...api.esquemaAtualizacao.shape },
    },
    ({ id, ...campos }) => executar(() => api.atualizarTarefa(id, api.validar(api.esquemaAtualizacao, campos), tokenId)),
  );

  s.registerTool(
    "atribuir",
    {
      title: "Atribuir pessoa",
      description: `Propõe atribuir uma pessoa a uma tarefa que já existe (responsável ou apoio), com os itens dela. ${SO_DEPOIS}`,
      inputSchema: {
        tarefa_id: z.string(),
        pessoa: z.string(),
        papel: z.enum(["responsavel", "apoio"]).optional(),
        itens: z.array(z.string()).optional(),
      },
    },
    ({ tarefa_id, ...a }) => executar(() => api.atribuir(tarefa_id, api.validar(api.esquemaAtribuicao, a), tokenId)),
  );

  s.registerTool(
    "marcar_item",
    { title: "Marcar item", description: `Propõe marcar ou desmarcar um item do checklist de uma pessoa. ${SO_DEPOIS}`, inputSchema: { item_id: z.string(), feito: z.boolean() } },
    ({ item_id, feito }) => executar(() => api.atualizarItem(item_id, { feito }, tokenId)),
  );

  s.registerTool(
    "adicionar_documento",
    {
      title: "Adicionar documento",
      description: `Propõe ligar um documento do Google Drive ou Google Docs a uma tarefa que já existe. ${SO_DEPOIS} Tipos: roteiro, registro, sintese, entregavel, outro.`,
      inputSchema: {
        tarefa_id: z.string(),
        titulo: z.string(),
        url: z.string(),
        tipo: z.enum(["roteiro", "registro", "sintese", "entregavel", "outro"]).optional(),
      },
    },
    ({ tarefa_id, ...d }) => executar(() => api.adicionarDocumento(tarefa_id, api.validar(api.esquemaDocumento, d), tokenId)),
  );

  s.registerTool(
    "comentar",
    { title: "Comentar", description: `Propõe um comentário numa tarefa, que aparece como Claude. ${SO_DEPOIS}`, inputSchema: { tarefa_id: z.string(), texto: z.string() } },
    ({ tarefa_id, texto }) => executar(() => api.comentar(tarefa_id, texto, tokenId)),
  );

  s.registerTool(
    "listar_propostas",
    {
      title: "Listar propostas",
      description:
        "Lista o que foi pedido por aqui e a situação de cada pedido: pendente, aprovada, recusada ou falhou (com o erro). " +
        "Depois de aprovada, traz o id e o link da tarefa.",
      inputSchema: { status: z.enum(["pendente", "aprovada", "recusada", "falhou"]).optional() },
    },
    ({ status }) => executar(() => api.listarPropostas(status)),
  );

  s.registerTool(
    "pauta_proxima_reuniao",
    {
      title: "Pauta da próxima reunião",
      description: "Pauta gerada da próxima reunião: entrega da semana, tarefas atrasadas, concluídas desde a última reunião e contatos novos.",
    },
    () => executar(() => api.pautaProximaReuniao()),
  );

  return s;
}

async function tratar(req: Request) {
  let tokenId: string;
  try {
    const url = new URL(req.url);
    // ?token= só para quem ainda não manda o cabeçalho (DUVIDAS, item 20)
    const cabecalho = req.headers.get("authorization") ?? (url.searchParams.get("token") ? `Bearer ${url.searchParams.get("token")}` : null);
    tokenId = await api.validarToken(cabecalho);
  } catch (e) {
    const erro = e instanceof api.ErroApi ? e : new api.ErroApi(401, "nao_autorizado", "Não autorizado.");
    return NextResponse.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: erro.status });
  }
  // Sem sessão não há fluxo para abrir nem para encerrar. O GET abriria um fluxo
  // que nunca manda nada nem termina, e isso prenderia a função na Vercel.
  if (req.method !== "POST")
    return NextResponse.json({ erro: { codigo: "metodo_nao_permitido", mensagem: "Use POST." } }, { status: 405, headers: { Allow: "POST" } });
  const servidor = criarServidor(tokenId);
  const transporte = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await servidor.connect(transporte);
  return transporte.handleRequest(req);
}

export { tratar as GET, tratar as POST, tratar as DELETE };
