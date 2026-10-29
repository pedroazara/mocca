import "server-only";
import type { Consulta } from "@/lib/banco";
import * as dados from "./dados";
import { proximaReuniao, semanaAtual } from "./datas";
import { montarPauta, reuniaoAnteriorA } from "./pauta";

// Carregamentos compostos usados por mais de uma página do painel.

export async function carregarSemana(q: Consulta, numero?: number) {
  const semanas = await dados.semanas(q);
  const atual = semanaAtual(semanas);
  const semana = semanas.find((s) => s.numero === numero) ?? atual ?? semanas[0];
  const [tarefas, contatosNovos, documentosSemana, cfg, reunioes] = [
    await dados.tarefas(q),
    await dados.contatos(q, { status: "novo" }),
    semana ? await dados.documentosDaSemana(q, semana.id) : [],
    await dados.configuracao(q),
    await dados.reunioes(q),
  ];

  // próxima reunião: a reunião futura mais próxima já criada, ou a data da configuração
  const agora = Date.now();
  const futura = [...reunioes].reverse().find((r) => new Date(r.data).getTime() >= agora - 3 * 3600000);
  const dataProxima = futura?.data ?? proximaReuniao(cfg.reuniao_dia_semana, cfg.reuniao_hora)?.toISOString() ?? null;
  const pauta = dataProxima
    ? montarPauta({
        semanas,
        tarefas,
        contatos: contatosNovos,
        dataReuniao: dataProxima,
        reuniaoAnterior: reuniaoAnteriorA(reunioes, dataProxima),
      })
    : null;

  return {
    semana,
    tarefas,
    contatosNovos,
    documentosSemana,
    proxima: {
      id: futura?.id ?? null,
      data: dataProxima,
      atrasadas: pauta?.atrasadas.length ?? 0,
      concluidas: pauta?.concluidas.length ?? 0,
      contatos: pauta?.contatosNovos.length ?? 0,
    },
  };
}
