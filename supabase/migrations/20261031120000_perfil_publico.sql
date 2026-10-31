-- Foto e LinkedIn de cada pessoa na página Equipe do site (seção 6.5). Ficam fora
-- de `pessoa` porque eu() faz select * nela a cada requisição, e a foto não deve
-- ir junto. A foto é um JPEG já reduzido no navegador. O site lê pelo service role
-- (página /equipe e rota /api/fotos); no painel, todos leem e só o admin altera.

create table perfil_publico (
  pessoa_id  uuid primary key references pessoa(id) on delete cascade,
  linkedin   text check (linkedin ~ '^https://([a-z0-9-]+\.)*linkedin\.com/'),
  foto       bytea check (octet_length(foto) <= 1048576),
  foto_em    timestamptz                 -- muda a URL da foto, que fica em cache
);

alter table perfil_publico enable row level security;

create policy perfil_publico_ler    on perfil_publico for select to authenticated using (sou_membro());
create policy perfil_publico_criar  on perfil_publico for insert to authenticated with check (sou_admin());
create policy perfil_publico_editar on perfil_publico for update to authenticated using (sou_admin()) with check (sou_admin());
