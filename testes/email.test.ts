// E-mails automáticos: textos, quem recebe e o que acontece sem senha ou com
// falha de envio. O SMTP e o banco são simulados; a consulta real está em banco.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmacaoContato, enderecoDeExemplo, tarefaAtribuida } from "@/lib/email/mensagens";

const sim = vi.hoisted(() => ({
  fila: [] as (() => Promise<unknown>)[],
  sendMail: vi.fn(),
  linhas: {} as { atribuicao?: unknown[]; contato?: unknown[] },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => Promise<unknown>) => sim.fila.push(fn) }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: sim.sendMail }) } }));
vi.mock("@/lib/banco", () => ({
  comoServico: (fn: (q: (sql: string) => Promise<unknown[]>) => Promise<unknown>) =>
    fn(async (sql) => (sql.includes("t.contato_id") ? sim.linhas.contato : sim.linhas.atribuicao) ?? []),
}));

const { avisarAtribuicao, avisarContatoRecebido } = await import("@/lib/email");

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

  it("uma falha de envio não derruba nada e os outros e-mails ainda saem", async () => {
    sim.linhas.contato = [{ tarefa_id: "t1", pessoa_id: "p1" }];
    sim.sendMail.mockRejectedValueOnce(new Error("535 senha recusada"));
    avisarContatoRecebido("c1", { nome: "Maria Teste", email: "maria@fazenda.test" });
    await expect(aposResposta()).resolves.toBeDefined();
    expect(sim.sendMail).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledOnce();
  });
});
