-- WhatsApp de contato no site (pedido do Pedro em 2026-11-10). Quem tem o número
-- preenchido vira um botão de WhatsApp na chamada final, no cartão "Produtores de
-- café" e na página Contato. Fica em perfil_publico, junto da foto e do LinkedIn:
-- o site lê pelo service role e, no painel, só o admin altera (Equipe › editar
-- pessoa). Guarda só dígitos, com 55 e DDD, que é o formato do wa.me.

alter table perfil_publico
  add column whatsapp text check (whatsapp ~ '^55[1-9][0-9]{9,10}$');
