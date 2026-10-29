export type Tema = "claro" | "escuro" | "sistema";

export const CHAVE_TEMA = "mocca-tema";

// Roda no <head> antes da pintura. Sem tema salvo (ou "sistema"), o CSS segue
// prefers-color-scheme; com "claro" ou "escuro", fixa <html data-tema>.
export const scriptTema = `(function(){try{var t=localStorage.getItem("${CHAVE_TEMA}");if(t==="claro"||t==="escuro"){document.documentElement.dataset.tema=t}}catch(e){}})();`;

export function aplicarTema(tema: Tema) {
  const raiz = document.documentElement;
  try {
    if (tema === "sistema") localStorage.removeItem(CHAVE_TEMA);
    else localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // navegação privada: o tema vale só para esta aba
  }
  if (tema === "sistema") delete raiz.dataset.tema;
  else raiz.dataset.tema = tema;
}
