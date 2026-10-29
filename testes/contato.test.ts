import { describe, expect, it } from "vitest";
import { esquemaContato, formatarTelefone, lerArea, paraRegistro } from "@/lib/validacao/contato";

const valido = {
  nome: "Maria Teste",
  email: "Maria@Exemplo.com",
  telefone: "(35) 99999-8888",
  perfil: "pesquisador",
  cidade_uf: "Lavras, MG",
  area_ha: "",
  tipo_colheita: "",
  mensagem: "Gostaria de saber mais sobre o projeto.",
  consentimento: true,
};

const erros = (dados: object) => {
  const r = esquemaContato.safeParse(dados);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe("formulário de contato", () => {
  it("aceita um envio completo", () => {
    expect(esquemaContato.safeParse(valido).success).toBe(true);
  });

  it("exige nome, e-mail, perfil, mensagem e consentimento", () => {
    expect(Object.keys(erros({}))).toEqual(
      expect.arrayContaining(["nome", "email", "perfil", "mensagem", "consentimento"]),
    );
  });

  it("respeita os limites de tamanho", () => {
    expect(erros({ ...valido, nome: "M" })).toHaveProperty("nome");
    expect(erros({ ...valido, nome: "x".repeat(121) })).toHaveProperty("nome");
    expect(erros({ ...valido, mensagem: "curta" })).toHaveProperty("mensagem");
    expect(erros({ ...valido, mensagem: "x".repeat(3001) })).toHaveProperty("mensagem");
  });

  it("valida telefone brasileiro com DDD", () => {
    expect(erros({ ...valido, telefone: "9999-8888" })).toHaveProperty("telefone");
    expect(erros({ ...valido, telefone: "(35) 3822-1234" })).toEqual({});
    expect(erros({ ...valido, telefone: "" })).toEqual({});
  });

  it("pede área e tipo de colheita só para produtor", () => {
    expect(erros({ ...valido, perfil: "produtor" })).toMatchObject({
      area_ha: expect.any(String),
      tipo_colheita: expect.any(String),
    });
    expect(erros({ ...valido, perfil: "produtor", area_ha: "100001", tipo_colheita: "Mista" })).toHaveProperty(
      "area_ha",
    );
    expect(erros({ ...valido, perfil: "produtor", area_ha: "25,5", tipo_colheita: "Mista" })).toEqual({});
  });

  it("mostra os erros de produtor junto com os outros", () => {
    expect(erros({ ...valido, nome: "", perfil: "produtor" })).toMatchObject({
      nome: expect.any(String),
      area_ha: expect.any(String),
    });
  });

  it("formata o telefone enquanto a pessoa digita", () => {
    expect(formatarTelefone("35")).toBe("(35");
    expect(formatarTelefone("3599999")).toBe("(35) 9999-9");
    expect(formatarTelefone("35999998888")).toBe("(35) 99999-8888");
    expect(formatarTelefone("3538221234")).toBe("(35) 3822-1234");
  });

  it("lê área com vírgula ou ponto", () => {
    expect(lerArea("25,5")).toBe(25.5);
    expect(lerArea("1.250")).toBe(1250);
    expect(lerArea("")).toBeNull();
  });

  it("converte para o registro do banco", () => {
    const r = esquemaContato.parse({ ...valido, perfil: "produtor", area_ha: "12", tipo_colheita: "Manual" });
    expect(paraRegistro(r)).toMatchObject({
      email: "maria@exemplo.com",
      telefone: "35999998888",
      area_ha: 12,
      tipo_colheita: "Manual",
      consentiu: true,
    });
    const outro = esquemaContato.parse({ ...valido, area_ha: "12", tipo_colheita: "Manual" });
    expect(paraRegistro(outro)).toMatchObject({ area_ha: null, tipo_colheita: null });
  });
});
