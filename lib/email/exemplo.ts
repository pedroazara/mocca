// Os e-mails do seed são @exemplo.com, um domínio que pode ter dono de verdade.
// Enquanto a equipe não preencher os reais, nada sai para lá. Fica num arquivo
// à parte para a janela da tarefa usar sem levar os modelos de e-mail junto.
export const enderecoDeExemplo = (para: string) => /@exemplo\.com$/i.test(para.trim());
