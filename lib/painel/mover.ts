import type { Consulta } from "@/lib/banco";
import { posicaoEntre } from "./quadro";
import type { Status } from "./tipos";

// Passar a tarefa para outra semana (tela Semana, DUVIDAS 4m), em SQL puro para
// a ação do painel e o teste do banco usarem o mesmo texto.
//
// $1 = id da tarefa, $2 = número da semana de destino. O prazo vai junto quando
// caía dentro da semana antiga: anda semanas inteiras, no mesmo dia da semana e
// horário (de Brasília), e o prazo do último dia da semana vai para o último dia
// da nova. Como o admin pode mudar as datas das semanas (Cronograma), o dia
// fica sempre dentro da semana de destino: se o salto cai fora dela, o prazo
// anda mais semanas inteiras até entrar; se a semana nova é curta e não tem
// aquele dia da semana, fica na ponta mais perto. Prazo fora da semana antiga,
// ou sem prazo, fica como está. Devolve o id e o prazo novo; nenhuma linha se a
// tarefa não existe, a semana não existe ou o RLS não deixa.
//
// A tarefa é travada antes da conta (`for update`): se outra pessoa está
// mudando o prazo ou a semana dela no mesmo instante, o comando espera e faz a
// conta com o que ela gravou, em vez de passar por cima.
//
// Na conta: `alvo` é o prazo andado tantas semanas inteiras quantas separam o
// começo das duas semanas; `n.inicio + resto` é o primeiro dia da semana nova
// com o mesmo dia da semana do prazo, e `n.fim - (...) % 7`, o último.
export const SQL_MOVER_PARA_SEMANA = `
  with a as (
    select id, semana_id,
           (prazo at time zone 'America/Sao_Paulo')::date as dia,
           (prazo at time zone 'America/Sao_Paulo')::time as hora
      from tarefa where id = $1 for update
  )
  update tarefa t
     set semana_id = n.id,
         prazo = case
           when a.dia between v.inicio and v.fim then (
             case
               when a.dia = v.fim then n.fim
               when n.inicio + p.resto > n.fim then greatest(n.inicio, least(n.fim, p.alvo))
               else greatest(n.inicio + p.resto, least(p.alvo, n.fim - (n.fim - n.inicio - p.resto) % 7))
             end + a.hora
           ) at time zone 'America/Sao_Paulo'
           else t.prazo end
    from a
    join semana n on n.numero = $2
    left join semana v on v.id = a.semana_id
    cross join lateral (
      select a.dia + 7 * round((n.inicio - v.inicio) / 7.0)::int as alvo,
             ((a.dia - n.inicio) % 7 + 7) % 7 as resto
    ) p
   where t.id = a.id
  returning t.id, t.prazo`;

// Quadro (seção 9.3, DUVIDAS 4q): põe a tarefa na coluna `status`, entre os
// vizinhos que a pessoa viu na tela (`antes` em cima, `depois` embaixo; null na
// ponta). A posição é calculada aqui, com o que está gravado agora, e não na
// tela: se outra pessoa mexeu na coluna, vale o que ela gravou. Quando não há
// número entre os vizinhos (posições empatadas, que vêm, por exemplo, da
// importação do Trello, ou um vão que ficou pequeno de tanto dividir), a coluna
// é renumerada de 1024 em 1024, na ordem em que aparece, e a conta é refeita.
// Os movimentos numa mesma coluna esperam um pelo outro (trava da transação).
// Devolve o id, ou nenhuma linha se o RLS não deixa.
export async function moverNoQuadro(q: Consulta, id: string, status: Status, antes: string | null, depois: string | null) {
  await q("select pg_advisory_xact_lock(hashtext($1))", [`mocca:quadro:${status}`]);
  const ler = async () => {
    const ids = [antes, depois].filter((v): v is string => Boolean(v) && v !== id);
    const linhas = ids.length
      ? await q<{ id: string; posicao: number }>(
          "select id, posicao from tarefa where id = any($1::uuid[]) and status = $2::status_tarefa and not arquivada",
          [ids, status],
        )
      : [];
    const de = (v: string | null) => linhas.find((l) => l.id === v)?.posicao ?? null;
    return { a: de(antes), d: de(depois) };
  };

  let { a, d } = await ler();
  let posicao: number | null;
  if (a === null && d === null) {
    // coluna vazia na tela (ou vizinhos que saíram dela): vai para o fim
    const [fim] = await q<{ p: number }>(
      "select coalesce(max(posicao), 0) + 1 as p from tarefa where status = $1::status_tarefa and id <> $2 and not arquivada",
      [status, id],
    );
    posicao = Number(fim.p);
  } else {
    posicao = posicaoEntre(a, d);
  }
  if (posicao === null) {
    await q(
      `update tarefa t set posicao = o.n * 1024
         from (select id, row_number() over (order by posicao, criado_em, id) as n
                 from tarefa where status = $1::status_tarefa and id <> $2 and not arquivada) o
        where t.id = o.id and t.posicao is distinct from o.n * 1024`,
      [status, id],
    );
    ({ a, d } = await ler());
    // depois de renumerar há 1024 entre vizinhos; se a ordem deles estava
    // invertida (outra pessoa mexeu), a tarefa fica logo depois de `antes`
    posicao = posicaoEntre(a, d) ?? (a !== null ? a + 512 : d! - 512);
  }
  return q<{ id: string }>("update tarefa set status = $2::status_tarefa, posicao = $3 where id = $1 returning id", [id, status, posicao]);
}
