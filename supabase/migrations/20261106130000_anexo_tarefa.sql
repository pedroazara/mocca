-- Fotos e PDFs também nas tarefas (pedido de 2026-11-06), na seção Documentos.
-- A tabela é a mesma dos anexos da entrega da semana (20261106120000): cada
-- anexo agora é de uma semana ou de uma tarefa, nunca dos dois. As regras de
-- acesso, os limites de tamanho e a rota /painel/anexos/{id} não mudam.
--
-- Só acrescenta: o código anterior, que lê os anexos pela semana, continua
-- funcionando com ela. Apagar a tarefa apaga os anexos dela.

alter table anexo_entrega add column tarefa_id uuid references tarefa(id) on delete cascade;
alter table anexo_entrega alter column semana_id drop not null;
alter table anexo_entrega add constraint anexo_entrega_dono check ((semana_id is null) <> (tarefa_id is null));

create index anexo_entrega_tarefa_idx on anexo_entrega (tarefa_id, criado_em) where tarefa_id is not null;
