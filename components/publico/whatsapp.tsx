import { Botao } from "@/components/ui/botao";
import { contatosWhatsapp } from "@/lib/contatos-whatsapp";
import { formatarWhatsapp, linkWhatsapp } from "@/lib/painel/perfil";
import { cn } from "@/lib/utils";
import { IconeWhatsapp } from "./icone-whatsapp";

// WhatsApp da equipe no site. Aparece um botão por pessoa com número no painel
// (Equipe › editar pessoa); sem ninguém, nada é desenhado e fica só o formulário.

const NOVA_ABA = { target: "_blank", rel: "noopener noreferrer" } as const;

// Sobre os fundos escuros de cor fixa: chamada final e cartão "Produtores de café".
export async function WhatsappNoEscuro({ className, alinhar = "inicio" }: { className?: string; alinhar?: "inicio" | "fim" }) {
  const contatos = await contatosWhatsapp();
  if (!contatos.length) return null;
  const fim = alinhar === "fim";
  return (
    <div className={cn(fim && "md:text-right", className)}>
      <p className="text-[0.9375rem] text-creme/85">Ou chame no WhatsApp:</p>
      <ul className={cn("mt-2 flex flex-wrap gap-2", fim && "md:justify-end")}>
        {contatos.map((c) => (
          <li key={c.numero}>
            <Botao asChild variante="claroContorno">
              <a href={linkWhatsapp(c.numero)} {...NOVA_ABA}>
                <IconeWhatsapp />
                {c.nome}
                <span className="sr-only"> no WhatsApp (abre em nova aba)</span>
              </a>
            </Botao>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Na coluna da página Contato, no mesmo desenho do e-mail e do Instagram.
export async function WhatsappNoContato() {
  const contatos = await contatosWhatsapp();
  if (!contatos.length) return null;
  return (
    <div className="flex gap-4">
      <IconeWhatsapp className="mt-1 size-[22px] shrink-0 text-caramelo" />
      <ul className="min-w-0 space-y-1">
        {contatos.map((c) => (
          <li key={c.numero}>
            <a href={linkWhatsapp(c.numero)} {...NOVA_ABA} className="link">
              {c.nome}: {formatarWhatsapp(c.numero)}
              <span className="sr-only"> no WhatsApp (abre em nova aba)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
