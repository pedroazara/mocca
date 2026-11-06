-- Anexos da entrega da semana (pedido de 2026-11-06): fotos e PDFs. Ficam no
-- Postgres, como a foto da Equipe, mas só a equipe vê: a rota /painel/anexos/{id}
-- lê como a pessoa logada, então quem decide é o RLS.
--
-- A foto chega já reduzida no navegador, em JPEG (lado maior até 1600 px), com a
-- miniatura da grade (até 640 px): o arquivo original, com o GPS da câmera, não
-- sai do aparelho. O PDF vai como está, até 4 MB, o que cabe numa requisição da
-- Vercel (4,5 MB); maior que isso, vai para o Drive e entra como link.

create table anexo_entrega (
  id           uuid primary key default gen_random_uuid(),
  semana_id    uuid not null references semana(id) on delete cascade,
  tipo         text not null check (tipo in ('foto', 'pdf')),
  nome         text not null check (char_length(nome) between 1 and 200),
  arquivo      bytea not null check (octet_length(arquivo) <= 4194304),
  miniatura    bytea check (octet_length(miniatura) <= 262144),
  legenda      text check (char_length(legenda) <= 300),
  enviado_por  uuid references pessoa(id),
  criado_em    timestamptz not null default now(),
  -- foto: até 2 MB e sempre com miniatura; PDF: sem miniatura
  check (tipo = 'pdf' or octet_length(arquivo) <= 2097152),
  check ((tipo = 'foto') = (miniatura is not null))
);

create index anexo_entrega_semana_idx on anexo_entrega (semana_id, criado_em);

alter table anexo_entrega enable row level security;

-- Depois de enviado, o arquivo não muda: só a legenda.
revoke all on anexo_entrega from anon, authenticated;
grant select, insert, delete on anexo_entrega to authenticated;
grant update (legenda) on anexo_entrega to authenticated;
grant all on anexo_entrega to service_role;

-- Como os documentos: todos leem; admin e membro enviam, legendam e apagam.
-- Quem envia fica registrado como ele mesmo.
create policy anexo_entrega_ler    on anexo_entrega for select to authenticated using (sou_membro());
create policy anexo_entrega_criar  on anexo_entrega for insert to authenticated
  with check (posso_editar() and enviado_por = (eu()).id);
create policy anexo_entrega_editar on anexo_entrega for update to authenticated using (posso_editar()) with check (posso_editar());
create policy anexo_entrega_apagar on anexo_entrega for delete to authenticated using (posso_editar());
