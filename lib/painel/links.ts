const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const linkTarefa = (id: string) => `${SITE()}/painel/tarefas/${id}`;
export const linkProposta = (id: string) => `${SITE()}/painel/aprovacoes#proposta-${id}`;
