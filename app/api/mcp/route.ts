import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextResponse } from "next/server";
import { z } from "zod";
import * as api from "@/lib/api/servico";

// Servidor MCP do painel (seção 11.3), no transporte HTTP "streamable" do MCP,
// sem sessão (cada requisição é independente) e com o mesmo token da API.
// Toda ferramenta que escreve devolve o link da tarefa no painel.

export const dynamic = "force-dynamic";

const STATUS = z.enum(["a_fazer", "fazendo", "em_revisao", "feito"]);

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

function criarServidor() {
  const s = new McpServer(
    { name: "mocca-painel", version: "1.0.0" },
    {
      instructions:
        "Painel de tarefas da equipe MoCCa (UFLA, programa Avança Café). Use para criar tarefas depois das reuniões, " +
        "já atribuídas e com itens por pessoa. Pessoas podem ser indicadas por id, e-mail ou apelido (ex.: Gabriel, Pinotti). " +
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
        "Cria uma tarefa com atribuições e itens por pessoa numa só operação. Exemplo de atribuicoes: " +
        '[{"pessoa":"Gabriel","papel":"responsavel","itens":["Agendar 3 produtores"]},{"pessoa":"Marcos","papel":"apoio","itens":["Preencher a planilha"]}]. ' +
        "Sem prazo, vale o fim da semana. Etiquetas: Entregas, Validação do Produto, Técnico, Negócio, Marketing. Use origem 'reuniao' se veio da reunião.",
      inputSchema: api.esquemaNovaTarefa.shape,
    },
    (corpo) => executar(() => api.criarTarefa(api.validar(api.esquemaNovaTarefa, corpo))),
  );

  s.registerTool(
    "atualizar_tarefa",
    {
      title: "Atualizar tarefa",
      description: "Edita título, descrição, status, prazo, semana, etiquetas ou se está ligada à entrega.",
      inputSchema: { id: z.string(), ...api.esquemaAtualizacao.shape },
    },
    ({ id, ...campos }) => executar(() => api.atualizarTarefa(id, api.validar(api.esquemaAtualizacao, campos))),
  );

  s.registerTool(
    "atribuir",
    {
      title: "Atribuir pessoa",
      description: "Atribui uma pessoa a uma tarefa (responsável ou apoio) e cria os itens dela.",
      inputSchema: {
        tarefa_id: z.string(),
        pessoa: z.string(),
        papel: z.enum(["responsavel", "apoio"]).optional(),
        itens: z.array(z.string()).optional(),
      },
    },
    ({ tarefa_id, ...a }) => executar(() => api.atribuir(tarefa_id, api.validar(api.esquemaAtribuicao, a))),
  );

  s.registerTool(
    "marcar_item",
    { title: "Marcar item", description: "Marca ou desmarca um item do checklist de uma pessoa.", inputSchema: { item_id: z.string(), feito: z.boolean() } },
    ({ item_id, feito }) => executar(() => api.atualizarItem(item_id, { feito })),
  );

  s.registerTool(
    "adicionar_documento",
    {
      title: "Adicionar documento",
      description: "Liga um documento do Google Drive ou Google Docs à tarefa. Tipos: roteiro, registro, sintese, entregavel, outro.",
      inputSchema: {
        tarefa_id: z.string(),
        titulo: z.string(),
        url: z.string(),
        tipo: z.enum(["roteiro", "registro", "sintese", "entregavel", "outro"]).optional(),
      },
    },
    ({ tarefa_id, ...d }) => executar(() => api.adicionarDocumento(tarefa_id, api.validar(api.esquemaDocumento, d))),
  );

  s.registerTool(
    "comentar",
    { title: "Comentar", description: "Comenta numa tarefa; o comentário aparece como Claude.", inputSchema: { tarefa_id: z.string(), texto: z.string() } },
    ({ tarefa_id, texto }) => executar(() => api.comentar(tarefa_id, texto)),
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
  try {
    const url = new URL(req.url);
    // clientes que não conseguem mandar cabeçalho podem usar ?token= (ver README)
    const cabecalho = req.headers.get("authorization") ?? (url.searchParams.get("token") ? `Bearer ${url.searchParams.get("token")}` : null);
    await api.validarToken(cabecalho);
  } catch (e) {
    const erro = e instanceof api.ErroApi ? e : new api.ErroApi(401, "nao_autorizado", "Não autorizado.");
    return NextResponse.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: erro.status });
  }
  const servidor = criarServidor();
  const transporte = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await servidor.connect(transporte);
  return transporte.handleRequest(req);
}

export { tratar as GET, tratar as POST, tratar as DELETE };
