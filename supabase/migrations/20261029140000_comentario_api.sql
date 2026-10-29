-- Comentários feitos pela API do Claude (seção 11.2: "autor exibido como Claude").
-- Não há pessoa "Claude" na equipe: o comentário fica sem autor e marcado via_api.
alter table comentario alter column autor_id drop not null;
alter table comentario add column via_api boolean not null default false;
alter table comentario add constraint comentario_autor_ou_api check (autor_id is not null or via_api);
