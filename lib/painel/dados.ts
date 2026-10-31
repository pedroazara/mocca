import "server-only";
import type { Consulta } from "@/lib/banco";
import type {
  Configuracao,
  Contato,
  Etiqueta,
  Perfil,
  Pessoa,
  Reuniao,
  Semana,
  Status,
  TarefaCompleta,
  TarefaResumo,
  TokenApi,
} from "./tipos";

// Consultas do painel. Recebem a função de consulta já autenticada
// (comoUsuario/comoServico), então o RLS decide o que cada pessoa vê.

export async function pessoas(q: Consulta) {
  return q<Pessoa>(
    `select id, nome, apelido, email, frente, papel::text as papel, cor, ativo, auth_id
       from pessoa order by ativo desc, papel = 'orientador', nome`,
  );
}

// Só campos públicos: a página Equipe do site lê isto pelo service role.
export async function perfis(q: Consulta) {
  return q<Perfil>(
    `select p.id as pessoa_id, p.nome, f.linkedin,
            case when f.foto is not null
                 then '/api/fotos/' || p.id || '?v=' || extract(epoch from f.foto_em)::bigint end as foto_url
       from perfil_publico f join pessoa p on p.id = f.pessoa_id`,
  );
}

export async function semanas(q: Consulta) {
  return q<Semana>(
    `select id, numero, inicio::text as inicio, fim::text as fim, entrega_titulo, entrega_prazo,
            entrega_url, status::text as status, anotacoes
       from semana order by numero`,
  );
}

export async function etiquetas(q: Consulta) {
  return q<Etiqueta>("select id, nome, token from etiqueta order by nome");
}

export async function base(q: Consulta) {
  const [p, s, e] = [await pessoas(q), await semanas(q), await etiquetas(q)];
  return { pessoas: p, semanas: s, etiquetas: e };
}

const CAMPOS_TAREFA = `
  t.id, t.titulo, t.status::text as status, t.posicao, t.prazo, t.ligada_entrega,
  t.origem::text as origem, t.semana_id, s.numero as semana, t.concluido_em, t.criado_em,
  coalesce((select json_agg(te.etiqueta_id) from tarefa_etiqueta te where te.tarefa_id = t.id), '[]'::json) as etiquetas,
  coalesce((
    select json_agg(json_build_object(
             'id', a.id, 'pessoa_id', a.pessoa_id, 'papel', a.papel,
             'itens', coalesce((
               select json_agg(json_build_object('id', i.id, 'texto', i.texto, 'feito', i.feito) order by i.posicao, i.id)
                 from item i where i.atribuicao_id = a.id), '[]'::json))
           order by a.papel, a.posicao, a.id)
      from atribuicao a where a.tarefa_id = t.id), '[]'::json) as atribuicoes,
  (select count(*) from documento d where d.tarefa_id = t.id)::int as documentos,
  (select count(*) from comentario c where c.tarefa_id = t.id)::int as comentarios`;

export type FiltroTarefas = {
  semana?: number | null;
  pessoa?: string | null;
  status?: Status | null;
  etiqueta?: string | null;
  atrasadas?: boolean;
  reuniao?: string | null;
};

export async function tarefas(q: Consulta, f: FiltroTarefas = {}) {
  return q<TarefaResumo>(
    `select ${CAMPOS_TAREFA}
       from tarefa t left join semana s on s.id = t.semana_id
      where not t.arquivada
        and ($1::int is null or s.numero = $1)
        and ($2::uuid is null or exists (select 1 from atribuicao a where a.tarefa_id = t.id and a.pessoa_id = $2))
        and ($3::text is null or t.status::text = $3)
        and ($4::uuid is null or exists (select 1 from tarefa_etiqueta te where te.tarefa_id = t.id and te.etiqueta_id = $4))
        and (not $5::boolean or (t.prazo < now() and t.status <> 'feito'))
        and ($6::uuid is null or t.reuniao_id = $6)
      order by t.posicao, t.criado_em`,
    [f.semana ?? null, f.pessoa ?? null, f.status ?? null, f.etiqueta ?? null, Boolean(f.atrasadas), f.reuniao ?? null],
  );
}

export async function tarefa(q: Consulta, id: string): Promise<TarefaCompleta | null> {
  const [t] = await q<TarefaCompleta>(
    `select ${CAMPOS_TAREFA}, t.descricao, t.criado_por, t.reuniao_id, t.contato_id, t.arquivada,
       coalesce((select json_agg(json_build_object('id', d.id, 'titulo', d.titulo, 'url', d.url, 'tipo', d.tipo, 'criado_em', d.criado_em) order by d.criado_em)
                   from documento d where d.tarefa_id = t.id), '[]'::json) as lista_documentos,
       coalesce((select json_agg(json_build_object('id', c.id, 'autor_id', c.autor_id, 'via_api', c.via_api, 'texto', c.texto, 'criado_em', c.criado_em) order by c.criado_em)
                   from comentario c where c.tarefa_id = t.id), '[]'::json) as lista_comentarios,
       coalesce((select json_agg(json_build_object('id', h.id, 'autor_id', h.autor_id, 'via_api', h.via_api, 'acao', h.acao, 'detalhe', h.detalhe, 'criado_em', h.criado_em) order by h.criado_em desc, h.id desc)
                   from historico h where h.tarefa_id = t.id), '[]'::json) as historico
       from tarefa t left join semana s on s.id = t.semana_id
      where t.id = $1`,
    [id],
  );
  return t ?? null;
}

export async function contadores(q: Consulta, pessoaId: string) {
  const [c] = await q<{ minhas: number; contatos: number }>(
    `select
       (select count(distinct t.id) from tarefa t join atribuicao a on a.tarefa_id = t.id
         where a.pessoa_id = $1 and t.status <> 'feito' and not t.arquivada)::int as minhas,
       (select count(*) from contato where status = 'novo')::int as contatos`,
    [pessoaId],
  );
  return c;
}

export async function configuracao(q: Consulta) {
  const [c] = await q<Configuracao>(
    `select reuniao_dia_semana, to_char(reuniao_hora, 'HH24:MI') as reuniao_hora, responsavel_contato_id
       from configuracao where id = 1`,
  );
  return c ?? { reuniao_dia_semana: null, reuniao_hora: null, responsavel_contato_id: null };
}

const CAMPOS_REUNIAO = `
  r.id, r.data, r.anotacoes, r.ata_url,
  coalesce((select json_agg(p.pessoa_id) from reuniao_presenca p where p.reuniao_id = r.id), '[]'::json) as presentes,
  coalesce((select json_agg(json_build_object('id', d.id, 'texto', d.texto) order by d.posicao, d.id)
              from decisao d where d.reuniao_id = r.id), '[]'::json) as decisoes`;

export async function reunioes(q: Consulta) {
  return q<Reuniao>(`select ${CAMPOS_REUNIAO} from reuniao r order by r.data desc`);
}

export async function reuniao(q: Consulta, id: string) {
  const [r] = await q<Reuniao>(`select ${CAMPOS_REUNIAO} from reuniao r where r.id = $1`, [id]);
  return r ?? null;
}

const CAMPOS_CONTATO = `
  c.id, c.nome, c.email, c.telefone, c.perfil::text as perfil, c.cidade_uf, c.area_ha::float8 as area_ha,
  c.tipo_colheita, c.mensagem, c.status::text as status, c.responsavel_id, c.notas, c.criado_em,
  (select t.id from tarefa t where t.contato_id = c.id order by t.criado_em limit 1) as tarefa_id`;

export async function contatos(q: Consulta, f: { perfil?: string | null; status?: string | null } = {}) {
  return q<Contato>(
    `select ${CAMPOS_CONTATO} from contato c
      where ($1::text is null or c.perfil::text = $1) and ($2::text is null or c.status::text = $2)
      order by c.criado_em desc`,
    [f.perfil ?? null, f.status ?? null],
  );
}

export async function contato(q: Consulta, id: string) {
  const [c] = await q<Contato>(`select ${CAMPOS_CONTATO} from contato c where c.id = $1`, [id]);
  return c ?? null;
}

export async function tokens(q: Consulta) {
  return q<TokenApi>("select id, nome, criado_em, ultimo_uso, revogado from token_api order by criado_em desc");
}

export async function documentosDaSemana(q: Consulta, semanaId: string) {
  return q<{ id: string; titulo: string; url: string; tipo: string }>(
    "select id, titulo, url, tipo::text as tipo from documento where semana_id = $1 order by criado_em",
    [semanaId],
  );
}

// Busca da paleta de comandos, sem diferenciar maiúsculas nem acentos
// (translate em vez da extensão unaccent, que o banco local não tem).
const semAcento = (expr: string) =>
  `translate(lower(${expr}), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;

export async function buscar(q: Consulta, termo: string) {
  const like = `%${termo.replace(/[%_\\]/g, "")}%`;
  const [t, r] = [
    await q<{ id: string; titulo: string; status: Status; semana: number | null }>(
      `select t.id, t.titulo, t.status::text as status, s.numero as semana
         from tarefa t left join semana s on s.id = t.semana_id
        where not t.arquivada and ${semAcento("t.titulo")} like ${semAcento("$1")}
        order by t.status = 'feito', t.criado_em desc limit 8`,
      [like],
    ),
    await q<{ id: string; data: string }>(
      `select id, data from reuniao
        where ${semAcento("coalesce(anotacoes, '')")} like ${semAcento("$1")}
        order by data desc limit 4`,
      [like],
    ),
  ];
  return { tarefas: t, reunioes: r };
}
