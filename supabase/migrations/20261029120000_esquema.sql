-- Esquema do banco do MoCCa (seção 10.1 e 10.2 da especificação).
-- Ordem de criação ajustada às chaves estrangeiras: reuniao e contato antes de tarefa.

create type papel_painel   as enum ('admin', 'membro', 'orientador');
create type status_tarefa  as enum ('a_fazer', 'fazendo', 'em_revisao', 'feito');
create type origem_tarefa  as enum ('manual', 'reuniao', 'claude', 'contato', 'trello');
create type papel_atrib    as enum ('responsavel', 'apoio');
create type tipo_documento as enum ('roteiro', 'registro', 'sintese', 'entregavel', 'outro');
create type status_semana  as enum ('nao_iniciada', 'em_andamento', 'entregue');
create type perfil_contato as enum ('produtor', 'fabricante', 'locadora', 'pesquisador', 'imprensa', 'outro');
create type status_contato as enum ('novo', 'em_conversa', 'respondido', 'arquivado');

create table pessoa (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique references auth.users(id) on delete set null,
  nome        text not null,
  apelido     text,                       -- usado em menções e pelo Claude: "Pinotti", "Gabriel"
  email       text not null unique,
  frente      text,
  papel       papel_painel not null default 'membro',
  cor         text not null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table semana (
  id                 uuid primary key default gen_random_uuid(),
  numero             int not null unique check (numero between 1 and 12),
  inicio             date not null,
  fim                date not null,
  entrega_titulo     text,
  entrega_prazo      timestamptz,
  entrega_url        text,
  status             status_semana not null default 'nao_iniciada',
  anotacoes          text,
  check (fim >= inicio)
);

create table etiqueta (
  id     uuid primary key default gen_random_uuid(),
  nome   text not null unique,
  token  text not null                     -- ex.: 'et-entregas'
);

create table reuniao (
  id          uuid primary key default gen_random_uuid(),
  data        timestamptz not null,
  anotacoes   text,
  ata_url     text,
  criado_em   timestamptz not null default now()
);

create table contato (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  email          text not null,
  telefone       text,
  perfil         perfil_contato not null,
  cidade_uf      text,
  area_ha        numeric,
  tipo_colheita  text,
  mensagem       text not null,
  consentiu      boolean not null,
  status         status_contato not null default 'novo',
  responsavel_id uuid references pessoa(id),
  notas          text,
  ip_hash        text,
  criado_em      timestamptz not null default now()
);

create table tarefa (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null check (char_length(titulo) between 1 and 200),
  descricao        text,
  status           status_tarefa not null default 'a_fazer',
  posicao          double precision not null default 0,
  semana_id        uuid references semana(id),
  prazo            timestamptz,
  ligada_entrega   boolean not null default false,
  origem           origem_tarefa not null default 'manual',
  reuniao_id       uuid references reuniao(id),
  contato_id       uuid references contato(id),
  trello_id        text unique,
  criado_por       uuid references pessoa(id),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  concluido_em     timestamptz,
  arquivada        boolean not null default false
);

create table tarefa_etiqueta (
  tarefa_id   uuid references tarefa(id) on delete cascade,
  etiqueta_id uuid references etiqueta(id) on delete cascade,
  primary key (tarefa_id, etiqueta_id)
);

create table atribuicao (
  id         uuid primary key default gen_random_uuid(),
  tarefa_id  uuid not null references tarefa(id) on delete cascade,
  pessoa_id  uuid not null references pessoa(id),
  papel      papel_atrib not null default 'responsavel',
  posicao    double precision not null default 0,
  unique (tarefa_id, pessoa_id)
);

create table item (
  id             uuid primary key default gen_random_uuid(),
  atribuicao_id  uuid not null references atribuicao(id) on delete cascade,
  texto          text not null,
  feito          boolean not null default false,
  feito_em       timestamptz,
  posicao        double precision not null default 0
);

create table documento (
  id         uuid primary key default gen_random_uuid(),
  tarefa_id  uuid references tarefa(id) on delete cascade,
  semana_id  uuid references semana(id) on delete cascade,
  titulo     text not null,
  url        text not null check (url ~ '^https://(drive|docs)\.google\.com/'),
  tipo       tipo_documento not null default 'outro',
  criado_em  timestamptz not null default now(),
  check (tarefa_id is not null or semana_id is not null)
);

create table reuniao_presenca (
  reuniao_id uuid references reuniao(id) on delete cascade,
  pessoa_id  uuid references pessoa(id),
  primary key (reuniao_id, pessoa_id)
);

create table decisao (
  id          uuid primary key default gen_random_uuid(),
  reuniao_id  uuid not null references reuniao(id) on delete cascade,
  texto       text not null,
  posicao     double precision not null default 0
);

create table comentario (
  id         uuid primary key default gen_random_uuid(),
  tarefa_id  uuid not null references tarefa(id) on delete cascade,
  autor_id   uuid not null references pessoa(id),
  texto      text not null,
  criado_em  timestamptz not null default now()
);

create table historico (
  id         bigserial primary key,
  tarefa_id  uuid not null references tarefa(id) on delete cascade,
  autor_id   uuid references pessoa(id),      -- null quando for a API do Claude
  via_api    boolean not null default false,
  acao       text not null,                   -- 'criou', 'status', 'atribuiu', 'desatribuiu', 'prazo', 'item_feito', ...
  detalhe    jsonb,
  criado_em  timestamptz not null default now()
);

create table configuracao (
  id                     int primary key default 1 check (id = 1),
  reuniao_dia_semana     int check (reuniao_dia_semana between 0 and 6),   -- 0 = domingo
  reuniao_hora           time,
  responsavel_contato_id uuid references pessoa(id)
);

create table token_api (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,             -- ex.: 'Claude do projeto'
  hash         text not null unique,      -- sha-256 do token; o token em si nunca é guardado
  criado_por   uuid references pessoa(id),
  criado_em    timestamptz not null default now(),
  ultimo_uso   timestamptz,
  revogado     boolean not null default false
);

create index tarefa_semana_status_idx on tarefa (semana_id, status);
create index tarefa_prazo_idx on tarefa (prazo);
create index atribuicao_pessoa_idx on atribuicao (pessoa_id);
create index contato_status_criado_idx on contato (status, criado_em);
create index contato_ip_hash_idx on contato (ip_hash, criado_em);   -- limite de envios por hora
create index item_atribuicao_idx on item (atribuicao_id);
create index historico_tarefa_idx on historico (tarefa_id, criado_em);
