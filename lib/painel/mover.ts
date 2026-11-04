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
// Na conta: `alvo` é o prazo andado tantas semanas inteiras quantas separam o
// começo das duas semanas; `n.inicio + resto` é o primeiro dia da semana nova
// com o mesmo dia da semana do prazo, e `n.fim - (...) % 7`, o último.
export const SQL_MOVER_PARA_SEMANA = `
  update tarefa t
     set semana_id = n.id,
         prazo = case
           when p.dia between v.inicio and v.fim then (
             case
               when p.dia = v.fim then n.fim
               when n.inicio + p.resto > n.fim then greatest(n.inicio, least(n.fim, p.alvo))
               else greatest(n.inicio + p.resto, least(p.alvo, n.fim - (n.fim - n.inicio - p.resto) % 7))
             end + p.hora
           ) at time zone 'America/Sao_Paulo'
           else t.prazo end
    from semana n
    left join semana v on v.id = (select semana_id from tarefa where id = $1)
    cross join lateral (
      select d.dia, d.hora,
             d.dia + 7 * round((n.inicio - v.inicio) / 7.0)::int as alvo,
             ((d.dia - n.inicio) % 7 + 7) % 7 as resto
        from (select (prazo at time zone 'America/Sao_Paulo')::date as dia,
                     (prazo at time zone 'America/Sao_Paulo')::time as hora
                from tarefa where id = $1) d
    ) p
   where t.id = $1 and n.numero = $2
  returning t.id, t.prazo`;
