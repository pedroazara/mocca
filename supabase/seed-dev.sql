-- Dados de EXEMPLO só para desenvolvimento (seção 10.4). Nunca rodar em produção.
-- 15 tarefas marcadas [EXEMPLO], espalhadas pelas pessoas, status e semanas,
-- uma reunião passada e dois contatos. Depende do seed.sql.

create function pg_temp.exemplo(
  p_titulo text,
  p_semana int,
  p_status status_tarefa,
  p_prazo_dia int,           -- dia da semana do prazo (0 = início da semana)
  p_etiqueta text,
  p_resp text,
  p_itens_resp text[],
  p_apoio text default null,
  p_itens_apoio text[] default '{}',
  p_entrega boolean default false
) returns uuid language plpgsql as $$
declare
  v_tarefa uuid;
  v_atrib uuid;
  v_semana semana%rowtype;
  v_texto text;
  v_pos int := 0;
begin
  select * into v_semana from semana where numero = p_semana;
  insert into tarefa (titulo, status, semana_id, prazo, ligada_entrega, posicao, origem)
  values ('[EXEMPLO] ' || p_titulo, p_status, v_semana.id,
          ((v_semana.inicio + p_prazo_dia) + time '18:00') at time zone 'America/Sao_Paulo',
          p_entrega, extract(epoch from clock_timestamp()), 'manual')
  returning id into v_tarefa;

  if p_etiqueta is not null then
    insert into tarefa_etiqueta (tarefa_id, etiqueta_id) select v_tarefa, id from etiqueta where nome = p_etiqueta;
  end if;

  if p_resp is not null then
    insert into atribuicao (tarefa_id, pessoa_id, papel)
    select v_tarefa, id, 'responsavel' from pessoa where apelido = p_resp
    returning id into v_atrib;
    foreach v_texto in array p_itens_resp loop
      v_pos := v_pos + 1;
      insert into item (atribuicao_id, texto, posicao) values (v_atrib, v_texto, v_pos);
    end loop;
  end if;

  if p_apoio is not null then
    insert into atribuicao (tarefa_id, pessoa_id, papel, posicao)
    select v_tarefa, id, 'apoio', 1 from pessoa where apelido = p_apoio
    returning id into v_atrib;
    foreach v_texto in array p_itens_apoio loop
      v_pos := v_pos + 1;
      insert into item (atribuicao_id, texto, posicao) values (v_atrib, v_texto, v_pos);
    end loop;
  end if;

  -- tarefas feitas têm todos os itens marcados; em andamento, o primeiro
  if p_status = 'feito' then
    update item set feito = true
     where atribuicao_id in (select id from atribuicao where tarefa_id = v_tarefa);
  elsif p_status in ('fazendo', 'em_revisao') then
    update item set feito = true
     where id in (select i.id from item i join atribuicao a on a.id = i.atribuicao_id
                   where a.tarefa_id = v_tarefa and a.papel = 'responsavel'
                   order by i.posicao limit 1);
  end if;
  return v_tarefa;
end $$;

do $$
declare
  v uuid;
begin
  v := pg_temp.exemplo('Entrevistas de disposição a pagar', 2, 'fazendo', 4, 'Validação do Produto',
       'Gabriel', array['Agendar 3 produtores', 'Conduzir as entrevistas', 'Resumir o que ouvimos'],
       'Marcos', array['Preencher a planilha de registro'], true);
  insert into documento (tarefa_id, titulo, url, tipo)
  values (v, 'Roteiro das entrevistas', 'https://docs.google.com/document/d/exemplo-roteiro', 'roteiro'),
         (v, 'Planilha de registro', 'https://docs.google.com/spreadsheets/d/exemplo-registro', 'registro');

  perform pg_temp.exemplo('Roteiro das entrevistas com produtores', 1, 'feito', 3, 'Validação do Produto',
       'Gabriel', array['Escrever o roteiro', 'Revisar com o orientador'],
       'Pedro', array['Montar a planilha de registro']);

  perform pg_temp.exemplo('Calibrar a medição de volume na bancada', 2, 'fazendo', 5, 'Técnico',
       'Pinotti', array['Montar a bancada', 'Medir 10 volumes conhecidos', 'Registrar o erro de cada medida'],
       'Pedro', array['Ajustar o código de leitura']);

  perform pg_temp.exemplo('Modelar o suporte do equipamento no tubo de saída', 2, 'a_fazer', 6, 'Técnico',
       'Henrique', array['Medir o tubo de saída da colhedora', 'Desenhar o suporte em 3D', 'Imprimir o primeiro protótipo']);

  v := pg_temp.exemplo('Pacote de Tarefas Semana 1', 1, 'feito', 6, 'Entregas',
       'Pedro', array['Organizar as tarefas da semana', 'Enviar ao programa'], null, '{}', true);
  insert into documento (tarefa_id, titulo, url, tipo)
  values (v, 'Pacote de Tarefas Semana 1', 'https://docs.google.com/document/d/exemplo-pacote-1', 'entregavel');

  v := pg_temp.exemplo('Canvas do projeto', 2, 'em_revisao', 6, 'Negócio',
       'Gabriel', array['Rascunho do canvas', 'Ajustar depois da mentoria'],
       'Pedro', array['Revisar a proposta de valor'], true);
  insert into documento (tarefa_id, titulo, url, tipo)
  values (v, 'Canvas MoCCa', 'https://docs.google.com/presentation/d/exemplo-canvas', 'entregavel');

  perform pg_temp.exemplo('Aplicar a logo nos materiais da equipe', 2, 'feito', 2, 'Marketing',
       'Marcos', array['Cartão de visita', 'Modelo de apresentação']);

  perform pg_temp.exemplo('Post de apresentação da equipe', 3, 'a_fazer', 3, 'Marketing',
       'Marcos', array['Escrever o texto', 'Separar fotos da equipe'], 'Gabriel', array['Revisar o texto']);

  perform pg_temp.exemplo('Lista de fabricantes e locadoras de colhedoras', 3, 'a_fazer', 4, 'Negócio',
       'Gabriel', array['Levantar fabricantes', 'Levantar locadoras da região']);

  perform pg_temp.exemplo('Testar a leitura de GPS em movimento', 3, 'a_fazer', 5, 'Técnico',
       'Pedro', array['Gravar um trajeto de teste', 'Comparar com o mapa'], 'Pinotti', array['Dirigir o trajeto']);

  -- atrasada: era da semana 1 e ainda não começou
  perform pg_temp.exemplo('Levantar custos dos componentes do protótipo', 1, 'a_fazer', 4, 'Negócio',
       'Henrique', array['Listar os componentes', 'Cotar preços em 3 lojas']);

  perform pg_temp.exemplo('Visita técnica a uma fazenda', 4, 'a_fazer', 2, 'Validação do Produto',
       'Pinotti', array['Combinar a data com o produtor', 'Levar o protótipo']);

  perform pg_temp.exemplo('Relatório da semana 1 para o orientador', 1, 'feito', 6, 'Entregas',
       'Pedro', array['Escrever o relatório']);

  -- sem responsável, para aparecer no bloco "Atenção"
  perform pg_temp.exemplo('Definir o horário fixo da reunião semanal', 2, 'a_fazer', 1, null, null, '{}');

  perform pg_temp.exemplo('Estudar estimativa de maturação por imagem', 4, 'a_fazer', 5, 'Técnico',
       'Pedro', array['Ler 3 artigos', 'Separar fotos de café cereja e verde'], 'Pinotti', array['Fotografar amostras']);
end $$;

-- uma reunião passada, com presença e decisões
with r as (
  insert into reuniao (data, anotacoes)
  values ((date '2026-10-22' + time '18:00') at time zone 'America/Sao_Paulo',
          '[EXEMPLO] Fechamos o roteiro das entrevistas e dividimos os produtores entre o Gabriel e o Marcos.')
  returning id
), p as (
  insert into reuniao_presenca (reuniao_id, pessoa_id)
  select r.id, pessoa.id from r, pessoa where pessoa.apelido in ('Gabriel', 'Pedro', 'Marcos', 'Pinotti')
)
insert into decisao (reuniao_id, texto, posicao)
select r.id, x.texto, x.pos from r,
  (values ('Entrevistar pelo menos 5 produtores até o fim da semana 2', 1),
          ('Henrique começa o suporte do equipamento na semana 2', 2)) as x(texto, pos);

-- contatos recebidos pelo site (um com mais de 3 dias sem resposta)
insert into contato (nome, email, telefone, perfil, cidade_uf, area_ha, tipo_colheita, mensagem, consentiu, status, criado_em, responsavel_id)
select '[EXEMPLO] João da Silva', 'joao@exemplo.com', '35999990000', 'produtor', 'Três Pontas, MG', 40, 'Mecanizada',
       'Tenho 40 ha de café e colho com máquina. Gostaria de participar dos testes.', true, 'novo',
       now() - interval '5 days', id
  from pessoa where apelido = 'Gabriel';
insert into contato (nome, email, perfil, cidade_uf, mensagem, consentiu, status, criado_em, responsavel_id)
select '[EXEMPLO] Ana Souza', 'ana@exemplo.com', 'pesquisador', 'Lavras, MG',
       'Pesquiso agricultura de precisão e queria conhecer o projeto.', true, 'em_conversa',
       now() - interval '1 day', id
  from pessoa where apelido = 'Gabriel';

update configuracao set reuniao_dia_semana = 4, reuniao_hora = '18:00' where id = 1;
