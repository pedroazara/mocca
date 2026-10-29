-- Dados iniciais (seção 10.4). Sem tarefas de exemplo: este arquivo vai para produção.
-- TODO(pedro): trocar os e-mails de exemplo pelos e-mails Google reais da equipe.
-- TODO(pedro): confirmar as datas e os títulos das entregas das 12 semanas do Avança Café.

insert into pessoa (nome, apelido, email, frente, papel, cor) values
  ('Gabriel Leonardo',    'Gabriel',  'gabriel.leonardo@exemplo.com', 'Estratégia e gestão, relacionamento com compradores', 'membro',     '#2F5F86'),
  ('Pedro Henrique',      'Pedro',    'pedro.henrique@exemplo.com',   'Tecnologia e operações, organização das tarefas',     'admin',      '#4A2C1D'),
  ('Marcos Ferreira',     'Marcos',   'marcos.ferreira@exemplo.com',  'Marketing, divulgação, identidade visual',            'membro',     '#7A3F7A'),
  ('Lucas Pinotti',       'Pinotti',  'lucas.pinotti@exemplo.com',    'Execução prática, testes',                            'membro',     '#3F6B4A'),
  ('Henrique Perez',      'Henrique', 'henrique.perez@exemplo.com',   'Protótipos, modelagem 3D',                            'membro',     '#8F4A1F'),
  ('Prof. Leomar Santos', 'Leomar',   'leomar.santos@exemplo.com',    'Orientador',                                          'orientador', '#5A5048')
on conflict (email) do nothing;

insert into etiqueta (nome, token) values
  ('Entregas',             'et-entregas'),
  ('Validação do Produto', 'et-validacao'),
  ('Técnico',              'et-tecnico'),
  ('Negócio',              'et-negocio'),
  ('Marketing',            'et-marketing')
on conflict (nome) do nothing;

-- 12 semanas de 7 dias, a semana 1 começando em 20/10/2026.
-- O prazo da entrega é o fim da semana, às 23:59 de Brasília.
insert into semana (numero, inicio, fim, entrega_titulo, entrega_prazo)
select n,
       date '2026-10-20' + (n - 1) * 7,
       date '2026-10-20' + (n - 1) * 7 + 6,
       case when n = 1 then 'Pacote de Tarefas Semana 1' else 'Entrega da semana ' || n end,
       ((date '2026-10-20' + (n - 1) * 7 + 6) + time '23:59') at time zone 'America/Sao_Paulo'
  from generate_series(1, 12) as n
on conflict (numero) do nothing;

-- TODO(pedro): dia e horário da reunião semanal (Configurações).
insert into configuracao (id, responsavel_contato_id)
select 1, id from pessoa where apelido = 'Gabriel'
on conflict (id) do nothing;
