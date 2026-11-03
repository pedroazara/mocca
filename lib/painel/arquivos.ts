import "server-only";
import type { Consulta } from "@/lib/banco";
import type { LinkDoPainel } from "@/lib/drive/arvore";

// Links do Drive guardados no painel, para a aba Arquivos mostrar onde cada
// arquivo aparece. Tarefas arquivadas ficam de fora, como no resto do painel.
export function linksDoDrive(q: Consulta) {
  return q<LinkDoPainel>(
    `select entrega_url as url, 'entrega' as onde, numero::text as ref, entrega_titulo as titulo, null::timestamptz as data
       from semana where entrega_url is not null
     union all
     select d.url, 'tarefa', t.id::text, t.titulo, null
       from documento d join tarefa t on t.id = d.tarefa_id
      where not t.arquivada
     union all
     select d.url, 'semana', s.numero::text, d.titulo, null
       from documento d join semana s on s.id = d.semana_id
     union all
     select ata_url, 'ata', id::text, null, data
       from reuniao where ata_url is not null`,
  );
}
