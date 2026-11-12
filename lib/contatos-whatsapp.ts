import "server-only";
import { cache } from "react";
import { comoServico } from "@/lib/banco";
import { whatsappsDoSite } from "@/lib/painel/dados";

// Quem atende pelo WhatsApp no site. Os números são editados no painel (Equipe ›
// editar pessoa); salvar lá renova as páginas na hora. Sem banco (build local,
// migração pendente), o site sai sem os botões de WhatsApp.
export const contatosWhatsapp = cache(async () => {
  try {
    return await comoServico((q) => whatsappsDoSite(q));
  } catch (e) {
    console.error("[whatsapp]", e);
    return [];
  }
});
