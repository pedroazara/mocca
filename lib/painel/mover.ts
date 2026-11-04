// Passar a tarefa para outra semana (tela Semana, DUVIDAS 4m), em SQL puro para
// a ação do painel e o teste do banco usarem o mesmo texto.
//
// $1 = id da tarefa, $2 = número da semana de destino. O prazo vai junto quando
// caía dentro da semana antiga (mesmo dia da semana e horário); prazo fora dela,
// ou sem prazo, fica como está. Devolve o id e o prazo novo; nenhuma linha se a
// tarefa não existe, a semana não existe ou o RLS não deixa.
export const SQL_MOVER_PARA_SEMANA = `
  update tarefa t
     set semana_id = n.id,
         prazo = case
           when t.prazo is not null and v.id is not null
            and (t.prazo at time zone 'America/Sao_Paulo')::date between v.inicio and v.fim
           then t.prazo + (n.inicio - v.inicio) * interval '1 day'
           else t.prazo end
    from semana n
    left join semana v on v.id = (select semana_id from tarefa where id = $1)
   where t.id = $1 and n.numero = $2
  returning t.id, t.prazo`;
