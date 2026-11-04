// E-mails automáticos: textos, quem recebe e o que acontece sem a chave ou com
// falha de envio. O Apps Script (fetch) e o banco são simulados; a consulta real
// está em banco.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmacaoContato, enderecoDeExemplo, entregaDaSemana, lembretesDaVespera, tarefaAtribuida } from "@/lib/email/mensagens";

const sim = vi.hoisted(() => ({
  fila: [] as (() => Promise<unknown>)[],
  // recebe o endereço do script e o corpo do POST; devolve a resposta dele
  envio: vi.fn<(url: string, corpo: Record<string, string>) => Promise<Response>>(),
  linhas: {} as {
    atribuicao?: unknown[];
    contato?: unknown[];
    anteriores?: number;
    lembretes?: unknown[];
    pendentes?: unknown[];
    semana?: unknown[];
    situacao?: unknown[];
    pacote?: unknown[];
  },
  registros: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => Promise<unknown>) => sim.fila.push(fn) }));
vi.stubGlobal("fetch", (url: string, init: RequestInit) => sim.envio(url, JSON.parse(String(init.body))));
vi.mock("@/lib/banco", () => ({
  comoServico: (fn: (q: (sql: string, params?: unknown[]) => Promise<unknown[]>) => Promise<unknown>) =>
    fn(async (sql, params) => {
      if (sql.includes("insert into email_enviado")) {
        sim.registros.push(params ?? []);
        return [];
      }
      if (sql.includes("t.contato_id")) return sim.linhas.contato ?? [];
      if (sql.includes("as falta")) return sim.linhas.situacao ?? [];
      if (sql.includes("from semana s where s.id")) return sim.linhas.semana ?? [];
      if (sql.includes("and not i.feito), '[]'::json) as itens,") && sql.includes("t.ligada_entrega and")) return sim.linhas.pacote ?? [];
      if (sql.includes("not exists (select 1 from email_enviado")) return sim.linhas.pendentes ?? [];
      if (sql.includes("from contato")) return [{ n: sim.linhas.anteriores ?? 0 }];
      if (sql.includes("not t.arquivada")) return sim.linhas.lembretes ?? [];
      return sim.linhas.atribuicao ?? [];
    }),
}));

const { avisarAtribuicao, avisarContatoRecebido, enviarAvisosPendentes, enviarLembretes, enviarPacote } = await import("@/lib/email");

const aposResposta = () => Promise.all(sim.fila.splice(0).map((fn) => fn()));
const destinos = () => sim.envio.mock.calls.map(([, corpo]) => corpo.para);
// o que o script responde quando o Gmail recusa, por exemplo com a cota do dia gasta
const recusa = () => Response.json({ ok: false, erro: "Exception: Service invoked too many times for one day: email." });

const atribuicao = {
  para: "gabriel@ufla.br",
  nome: "Gabriel",
  papel: "responsavel" as const,
  titulo: "Agendar <visita>",
  prazo: "2026-11-03T02:59:00.000Z",
  itens: ["Ligar & confirmar"],
};

describe("textos dos e-mails", () => {
  it("mostra título, papel, prazo em Brasília, itens e link", () => {
    const m = tarefaAtribuida({ ...atribuicao, autor: "Pedro", link: "https://mocca.test/painel/tarefas/1" });
    expect(m.para).toBe("gabriel@ufla.br");
    expect(m.assunto).toBe("Nova tarefa no MoCCa: Agendar <visita>");
    expect(m.texto).toContain("Pedro atribuiu uma tarefa a você");
    expect(m.texto).toContain("Papel: responsável");
    expect(m.texto).toContain("Prazo: 02/11");
    expect(m.texto).toContain("- Ligar & confirmar");
    expect(m.texto).toContain("https://mocca.test/painel/tarefas/1");
  });

  it("escapa o HTML do que veio do banco", () => {
    const { html } = tarefaAtribuida({ ...atribuicao, link: "https://mocca.test/t?a=1&b=2" });
    expect(html).toContain("Agendar &lt;visita&gt;");
    expect(html).toContain("Ligar &amp; confirmar");
    expect(html).toContain('href="https://mocca.test/t?a=1&amp;b=2"');
    expect(html).not.toContain("<visita>");
  });

  it("funciona sem prazo, sem itens e sem autor", () => {
    const m = tarefaAtribuida({ ...atribuicao, prazo: null, itens: [], link: "https://mocca.test/t" });
    expect(m.texto).toContain("Você recebeu uma tarefa");
    expect(m.texto).not.toContain("Prazo:");
    expect(m.texto).not.toContain("Seus itens:");
  });

  it("a confirmação de contato só usa o primeiro nome, e só se ele for uma palavra", () => {
    expect(confirmacaoContato({ para: "a@b.com", nome: "Maria da Silva" }).texto).toMatch(/^Olá, Maria\.\n/);
    expect(confirmacaoContato({ para: "a@b.com", nome: "João-Pedro D'Ávila" }).texto).toMatch(/^Olá, João-Pedro\.\n/);
    for (const nome of ["compre.agora.com hoje", "<b>Oi</b> teste", "https://spam.test/x"]) {
      const m = confirmacaoContato({ para: "a@b.com", nome });
      expect(m.texto).toMatch(/^Olá\.\n/);
      expect(m.html).not.toContain("spam");
      expect(m.html).not.toContain("<b>");
    }
  });

  it("o lembrete da véspera lista as tarefas, os itens abertos e o link, com o HTML escapado", () => {
    const [m] = lembretesDaVespera(
      [
        {
          para: "gabriel@ufla.br",
          nome: "Gabriel",
          papel: "apoio",
          tarefa_id: "t9",
          titulo: "Visita <técnica>",
          prazo: "2026-11-10T02:59:00.000Z",
          itens: ["Levar o protótipo & o notebook"],
        },
      ],
      (id) => `https://mocca.test/painel/tarefas/${id}`,
    );
    expect(m.assunto).toBe("Amanhã vence: Visita <técnica>");
    expect(m.texto).toContain("Prazo: 09/11 · você está de apoio");
    expect(m.texto).toContain("- Levar o protótipo & o notebook");
    expect(m.texto).toContain("https://mocca.test/painel/tarefas/t9");
    expect(m.html).toContain("Visita &lt;técnica&gt;");
    expect(m.html).toContain("Levar o protótipo &amp; o notebook");
  });

  it("o pacote da entrega agrupa por dia de prazo, em ordem, e escapa o HTML", () => {
    const tarefa = { papel: "apoio" as const, itens: ["Revisar <slides>"], outros: [], link: "https://mocca.test/t" };
    const m = entregaDaSemana({
      para: "marcos@ufla.br",
      nome: "Marcos",
      semana: { numero: 3, total: 12, entrega_titulo: null, entrega_prazo: "2026-11-10T02:59:00.000Z", entrega_url: null },
      tarefas: [
        { ...tarefa, titulo: "Pitch deck", prazo: "2026-11-09T02:59:00.000Z" },
        { ...tarefa, titulo: "Naming", prazo: "2026-11-08T02:59:00.000Z", papel: "responsavel" },
        { ...tarefa, titulo: "Sem data", prazo: null },
      ],
      linkPainel: "https://mocca.test/painel/minhas-tarefas",
    });
    expect(m.assunto).toBe("Entrega da semana 3: onde você entra");
    expect(m.texto.indexOf("SÁBADO, 07/11")).toBeLessThan(m.texto.indexOf("DOMINGO, 08/11"));
    expect(m.texto.indexOf("Naming")).toBeLessThan(m.texto.indexOf("Pitch deck"));
    expect(m.texto.indexOf("Pitch deck")).toBeLessThan(m.texto.indexOf("SEM PRAZO"));
    expect(m.texto).toContain("Você: responsável");
    expect(m.html).toContain("Revisar &lt;slides&gt;");
    expect(m.html).not.toContain("<slides>");
  });

  it("reconhece os endereços de exemplo do seed", () => {
    expect(enderecoDeExemplo("gabriel.leonardo@exemplo.com")).toBe(true);
    expect(enderecoDeExemplo("Gabriel@EXEMPLO.COM ")).toBe(true);
    expect(enderecoDeExemplo("gabriel@exemplo.com.br")).toBe(false);
    expect(enderecoDeExemplo("moccaufla@gmail.com")).toBe(false);
  });
});

describe("envio", () => {
  beforeEach(() => {
    sim.fila.length = 0;
    sim.envio.mockReset().mockImplementation(async () => Response.json({ ok: true, restantes: 99 }));
    sim.linhas = { atribuicao: [atribuicao] };
    sim.registros.length = 0;
    vi.stubEnv("GMAIL_SCRIPT_URL", "https://script.test/exec");
    vi.stubEnv("GMAIL_SCRIPT_CHAVE", "chave-de-teste");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("só envia depois da resposta, pelo script e com a chave dele", async () => {
    avisarAtribuicao("t1", "p1", { id: "p2", nome: "Pedro Henrique", apelido: "Pedro" });
    expect(sim.envio).not.toHaveBeenCalled();
    await aposResposta();
    expect(sim.envio).toHaveBeenCalledOnce();
    const [url, corpo] = sim.envio.mock.calls[0];
    expect(url).toBe("https://script.test/exec");
    expect(corpo).toMatchObject({ chave: "chave-de-teste", para: "gabriel@ufla.br", assunto: "Nova tarefa no MoCCa: Agendar <visita>" });
    expect(corpo.texto).toContain("Pedro atribuiu");
    expect(corpo.html).toContain("Agendar &lt;visita&gt;");
  });

  it("não avisa quem atribuiu a si mesmo", async () => {
    avisarAtribuicao("t1", "p1", { id: "p1", nome: "Gabriel", apelido: null });
    expect(sim.fila).toHaveLength(0);
  });

  it("não envia se a atribuição não foi gravada ou a pessoa está inativa", async () => {
    sim.linhas = { atribuicao: [] };
    avisarAtribuicao("t1", "p1");
    await aposResposta();
    expect(sim.envio).not.toHaveBeenCalled();
  });

  it("confirma para quem escreveu e avisa o responsável", async () => {
    sim.linhas.contato = [{ tarefa_id: "t1", pessoa_id: "p1" }];
    avisarContatoRecebido("c1", { nome: "Maria Teste", email: "maria@fazenda.test" });
    await aposResposta();
    expect(destinos()).toEqual(["maria@fazenda.test", "gabriel@ufla.br"]);
  });

  it("confirma mesmo sem responsável configurado", async () => {
    avisarContatoRecebido("c1", { nome: "Maria Teste", email: "maria@fazenda.test" });
    await aposResposta();
    expect(destinos()).toEqual(["maria@fazenda.test"]);
  });

  it("não envia para endereços de exemplo", async () => {
    sim.linhas = { atribuicao: [{ ...atribuicao, para: "gabriel.leonardo@exemplo.com" }] };
    avisarAtribuicao("t1", "p1");
    await aposResposta();
    expect(sim.envio).not.toHaveBeenCalled();
  });

  it("sem o endereço ou a chave do script, só registra no log", async () => {
    vi.stubEnv("GMAIL_SCRIPT_CHAVE", "");
    avisarContatoRecebido("c1", { nome: "Maria Teste", email: "maria@fazenda.test" });
    await aposResposta();
    vi.stubEnv("GMAIL_SCRIPT_CHAVE", "chave-de-teste");
    vi.stubEnv("GMAIL_SCRIPT_URL", "");
    avisarContatoRecebido("c2", { nome: "Maria Teste", email: "maria@fazenda.test" });
    await aposResposta();
    expect(sim.envio).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledTimes(2);
  });

  it("não confirma de novo para o mesmo endereço no mesmo dia, mas avisa o responsável", async () => {
    sim.linhas.contato = [{ tarefa_id: "t1", pessoa_id: "p1" }];
    sim.linhas.anteriores = 1;
    avisarContatoRecebido("c2", { nome: "Maria Teste", email: "maria@fazenda.test" });
    await aposResposta();
    expect(destinos()).toEqual(["gabriel@ufla.br"]);
  });

  it("lembrete da véspera: um e-mail por pessoa, com as tarefas dela", async () => {
    const base = { papel: "responsavel", prazo: "2026-11-10T02:59:00.000Z", itens: [] };
    sim.linhas.lembretes = [
      { ...base, para: "gabriel@ufla.br", nome: "Gabriel", tarefa_id: "t1", titulo: "Ligar para a cooperativa" },
      { ...base, para: "gabriel@ufla.br", nome: "Gabriel", tarefa_id: "t2", titulo: "Relatar a conversa" },
      { ...base, para: "marcos@ufla.br", nome: "Marcos", tarefa_id: "t1", titulo: "Ligar para a cooperativa", papel: "apoio" },
    ];
    expect(await enviarLembretes("2026-11-09")).toEqual({ tarefas: 2, emails: 2, enviados: 2 });
    expect(destinos()).toEqual(["gabriel@ufla.br", "marcos@ufla.br"]);
    expect(sim.envio.mock.calls[0][1].assunto).toBe("Amanhã vencem 2 tarefas suas no MoCCa");
    expect(sim.envio.mock.calls[1][1].assunto).toBe("Amanhã vence: Ligar para a cooperativa");
  });

  it("o lembrete conta só o que saiu: sem a chave, endereço de exemplo e falha de envio não contam", async () => {
    const base = { papel: "responsavel", prazo: "2026-11-10T02:59:00.000Z", itens: [], tarefa_id: "t1", titulo: "Ligar" };
    sim.linhas.lembretes = [
      { ...base, para: "gabriel@ufla.br", nome: "Gabriel" },
      { ...base, para: "marcos@exemplo.com", nome: "Marcos" },
      { ...base, para: "lucas@ufla.br", nome: "Lucas" },
    ];
    sim.envio.mockResolvedValueOnce(recusa());
    expect(await enviarLembretes("2026-11-09")).toEqual({ tarefas: 1, emails: 3, enviados: 1 });
    vi.stubEnv("GMAIL_SCRIPT_CHAVE", "");
    expect((await enviarLembretes("2026-11-09")).enviados).toBe(0);
  });

  it("registra o aviso que o Gmail aceitou, e só ele", async () => {
    avisarAtribuicao("t1", "p1");
    await aposResposta();
    expect(sim.registros).toEqual([["tarefa", "p1", "t1", null, "[]"]]);
    sim.envio.mockResolvedValueOnce(recusa());
    avisarAtribuicao("t1", "p1");
    await aposResposta();
    expect(sim.registros).toHaveLength(1);
  });

  it("tarefa ligada à entrega não tem aviso próprio: vai no pacote", async () => {
    sim.linhas = { atribuicao: [{ ...atribuicao, ligada_entrega: true }] };
    avisarAtribuicao("t1", "p1", { id: "p2", nome: "Pedro Henrique", apelido: "Pedro" });
    await aposResposta();
    expect(sim.envio).not.toHaveBeenCalled();
  });

  it("o botão da tarefa envia para quem falta e diz para quem não saiu", async () => {
    sim.linhas.pendentes = [
      { pessoa_id: "p1", nome: "Gabriel" },
      { pessoa_id: "p3", nome: "Marcos" },
    ];
    sim.envio.mockResolvedValueOnce(recusa());
    expect(await enviarAvisosPendentes("t1")).toEqual({ enviados: ["Marcos"], falharam: ["Gabriel"] });
    expect(sim.registros).toEqual([["tarefa", "p3", "t1", null, "[]"]]);
  });

  it("o pacote vai só para quem tem tarefa nova nele, com as tarefas registradas", async () => {
    sim.linhas.semana = [
      { id: "s3", numero: 3, total: 12, entrega_titulo: "Entrega da semana 3", entrega_prazo: "2026-11-10T02:59:00.000Z", entrega_url: null },
    ];
    sim.linhas.situacao = [
      { pessoa_id: "p1", nome: "Gabriel", tem_email: true, falta: true },
      { pessoa_id: "p3", nome: "Marcos", tem_email: true, falta: false },
      { pessoa_id: "p4", nome: "Henrique", tem_email: false, falta: true },
    ];
    const linha = { prazo: "2026-11-08T02:59:00.000Z", papel: "apoio", itens: ["Revisar"], outros: [] };
    sim.linhas.pacote = [
      { ...linha, pessoa_id: "p1", para: "gabriel@ufla.br", nome: "Gabriel", tarefa_id: "t1", titulo: "Pitch" },
      { ...linha, pessoa_id: "p1", para: "gabriel@ufla.br", nome: "Gabriel", tarefa_id: "t2", titulo: "Roadmap" },
      { ...linha, pessoa_id: "p3", para: "marcos@ufla.br", nome: "Marcos", tarefa_id: "t1", titulo: "Pitch" },
    ];
    expect(await enviarPacote("s3")).toEqual({ enviados: ["Gabriel"], falharam: [] });
    expect(destinos()).toEqual(["gabriel@ufla.br"]);
    expect(sim.envio.mock.calls[0][1].assunto).toBe("Entrega da semana 3: onde você entra");
    expect(sim.registros).toEqual([["entrega", "p1", null, "s3", JSON.stringify(["t1", "t2"])]]);
  });

  it("uma falha de envio não derruba nada e os outros e-mails ainda saem", async () => {
    sim.linhas.contato = [{ tarefa_id: "t1", pessoa_id: "p1" }];
    sim.envio.mockResolvedValueOnce(recusa());
    avisarContatoRecebido("c1", { nome: "Maria Teste", email: "maria@fazenda.test" });
    await expect(aposResposta()).resolves.toBeDefined();
    expect(sim.envio).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("rede caída e resposta que não é JSON do script também contam como falha", async () => {
    sim.linhas.pendentes = [
      { pessoa_id: "p1", nome: "Gabriel" },
      { pessoa_id: "p3", nome: "Marcos" },
      { pessoa_id: "p4", nome: "Henrique" },
    ];
    sim.envio
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("<html>Erro do Google</html>", { status: 500 }));
    expect(await enviarAvisosPendentes("t1")).toEqual({ enviados: ["Henrique"], falharam: ["Gabriel", "Marcos"] });
    expect(sim.registros).toEqual([["tarefa", "p4", "t1", null, "[]"]]);
  });
});
