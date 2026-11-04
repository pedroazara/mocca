// E-mails automáticos: textos, quem recebe e o que acontece sem senha ou com
// falha de envio. O SMTP e o banco são simulados; a consulta real está em banco.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmacaoContato, enderecoDeExemplo, lembretesDaVespera, tarefaAtribuida } from "@/lib/email/mensagens";

const sim = vi.hoisted(() => ({
  fila: [] as (() => Promise<unknown>)[],
  sendMail: vi.fn(),
  linhas: {} as { atribuicao?: unknown[]; contato?: unknown[]; anteriores?: number; lembretes?: unknown[] },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => Promise<unknown>) => sim.fila.push(fn) }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: sim.sendMail }) } }));
vi.mock("@/lib/banco", () => ({
  comoServico: (fn: (q: (sql: string) => Promise<unknown[]>) => Promise<unknown>) =>
    fn(async (sql) => {
      if (sql.includes("t.contato_id")) return sim.linhas.contato ?? [];
      if (sql.includes("from contato")) return [{ n: sim.linhas.anteriores ?? 0 }];
      if (sql.includes("not t.arquivada")) return sim.linhas.lembretes ?? [];
      return sim.linhas.atribuicao ?? [];
    }),
}));

const { avisarAtribuicao, avisarContatoRecebido, enviarLembretes } = await import("@/lib/email");

const aposResposta = () => Promise.all(sim.fila.splice(0).map((fn) => fn()));
const destinos = () => sim.sendMail.mock.calls.map(([m]) => m.to);

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
    sim.sendMail.mockReset().mockResolvedValue({});
    sim.linhas = { atribuicao: [atribuicao] };
    vi.stubEnv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("só envia depois da resposta, pela conta do MoCCa", async () => {
    avisarAtribuicao("t1", "p1", { id: "p2", nome: "Pedro Henrique", apelido: "Pedro" });
    expect(sim.sendMail).not.toHaveBeenCalled();
    await aposResposta();
    expect(sim.sendMail).toHaveBeenCalledOnce();
    const [m] = sim.sendMail.mock.calls[0];
    expect(m.from).toBe("MoCCa <moccaufla@gmail.com>");
    expect(m.to).toBe("gabriel@ufla.br");
    expect(m.text).toContain("Pedro atribuiu");
  });

  it("não avisa quem atribuiu a si mesmo", async () => {
    avisarAtribuicao("t1", "p1", { id: "p1", nome: "Gabriel", apelido: null });
    expect(sim.fila).toHaveLength(0);
  });

  it("não envia se a atribuição não foi gravada ou a pessoa está inativa", async () => {
    sim.linhas = { atribuicao: [] };
    avisarAtribuicao("t1", "p1");
    await aposResposta();
    expect(sim.sendMail).not.toHaveBeenCalled();
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
    expect(sim.sendMail).not.toHaveBeenCalled();
  });

  it("sem a senha, só registra no log", async () => {
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    avisarContatoRecebido("c1", { nome: "Maria Teste", email: "maria@fazenda.test" });
    await aposResposta();
    expect(sim.sendMail).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledOnce();
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
    expect(await enviarLembretes("2026-11-09")).toEqual({ tarefas: 2, emails: 2 });
    expect(destinos()).toEqual(["gabriel@ufla.br", "marcos@ufla.br"]);
    expect(sim.sendMail.mock.calls[0][0].subject).toBe("Amanhã vencem 2 tarefas suas no MoCCa");
    expect(sim.sendMail.mock.calls[1][0].subject).toBe("Amanhã vence: Ligar para a cooperativa");
  });

  it("uma falha de envio não derruba nada e os outros e-mails ainda saem", async () => {
    sim.linhas.contato = [{ tarefa_id: "t1", pessoa_id: "p1" }];
    sim.sendMail.mockRejectedValueOnce(new Error("535 senha recusada"));
    avisarContatoRecebido("c1", { nome: "Maria Teste", email: "maria@fazenda.test" });
    await expect(aposResposta()).resolves.toBeDefined();
    expect(sim.sendMail).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledOnce();
  });
});
