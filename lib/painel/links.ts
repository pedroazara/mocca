const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const linkTarefa = (id: string) => `${SITE()}/painel/tarefas/${id}`;
export const linkProposta = (id: string) => `${SITE()}/painel/aprovacoes#proposta-${id}`;
export const linkMinhasTarefas = () => `${SITE()}/painel/minhas-tarefas`;
// Imagens dos e-mails (public/email), com endereço completo: o leitor de e-mail busca no site publicado.
export const imagemEmail = (arquivo: string) => `${SITE()}/email/${arquivo}`;
