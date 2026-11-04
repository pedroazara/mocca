-- E-mails do painel que o Gmail aceitou: o aviso de tarefa atribuída e o pacote
-- da entrega da semana. A janela da tarefa e a tela Semana mostram para quem já
-- foi e oferecem enviar para quem falta. Só o servidor grava (service role).

create table email_enviado (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('tarefa', 'entrega')),
  pessoa_id  uuid not null references pessoa(id) on delete cascade,
  tarefa_id  uuid references tarefa(id) on delete cascade,   -- aviso de uma tarefa
  semana_id  uuid references semana(id) on delete cascade,   -- pacote da entrega
  tarefas    uuid[] not null default '{}',                   -- as tarefas que foram no pacote
  enviado_em timestamptz not null default now(),
  check (case tipo when 'tarefa' then tarefa_id is not null else semana_id is not null end)
);

create index email_enviado_tarefa_idx on email_enviado (tarefa_id) where tarefa_id is not null;
create index email_enviado_semana_idx on email_enviado (semana_id, pessoa_id) where semana_id is not null;

alter table email_enviado enable row level security;

revoke all on email_enviado from anon, authenticated;
grant select on email_enviado to authenticated;
grant select, insert on email_enviado to service_role;

create policy email_enviado_ler on email_enviado for select to authenticated using (sou_membro());
