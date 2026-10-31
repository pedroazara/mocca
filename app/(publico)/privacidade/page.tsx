import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidade",
  description:
    "Quais dados o formulário de contato do MoCCa coleta, para quê, por quanto tempo ficam guardados e como pedir a exclusão.",
  alternates: { canonical: "/privacidade" },
};

// TODO(pedro): e-mail real para pedidos sobre dados pessoais (seção 16).
const EMAIL_PRIVACIDADE = "privacidade@exemplo.com";

const secoes = [
  {
    titulo: "Quais dados coletamos",
    corpo: (
      <>
        <p>Só os que você escreve no formulário de contato:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>nome e e-mail;</li>
          <li>telefone ou WhatsApp, se você informar;</li>
          <li>perfil (produtor, fabricante, pesquisador e outros) e cidade, se você informar;</li>
          <li>para produtores, a área de café e o tipo de colheita;</li>
          <li>a mensagem.</li>
        </ul>
        <p className="mt-3">
          Para evitar abuso do formulário, guardamos também um código gerado a partir do endereço IP de quem enviou
          (um hash). Ele não permite recuperar o endereço original.
        </p>
      </>
    ),
  },
  {
    titulo: "Para que usamos",
    corpo: (
      <p>
        Para responder ao seu contato e, se você for produtor e tiver interesse, conversar sobre os testes de campo.
        Quando sua mensagem chega, enviamos uma confirmação automática para o seu e-mail, pela conta do projeto no
        Gmail. Não usamos os dados para propaganda e não os vendemos nem repassamos a terceiros.
      </p>
    ),
  },
  {
    titulo: "Por quanto tempo",
    corpo: <p>Guardamos os dados por até 2 anos depois do último contato. Depois disso, eles são apagados.</p>,
  },
  {
    titulo: "Quem acessa",
    corpo: (
      <p>
        Só a equipe do MoCCa, numa área restrita com login. O site também usa a verificação anti-spam da Cloudflare
        (Turnstile) no formulário.
      </p>
    ),
  },
  {
    titulo: "Seus direitos",
    corpo: (
      <p>
        Pela Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode pedir para ver, corrigir ou apagar seus dados
        a qualquer momento. Escreva para{" "}
        <a href={`mailto:${EMAIL_PRIVACIDADE}`} className="link">
          {EMAIL_PRIVACIDADE}
        </a>{" "}
        e responderemos em até 15 dias.
      </p>
    ),
  },
];

export default function Privacidade() {
  return (
    <div className="conteiner pt-12 pb-20 md:pt-20 md:pb-28">
      <p className="t-rotulo text-link">Privacidade</p>
      <h1 className="t-h1 mt-4 text-texto md:text-[3rem] md:leading-[1.08]">Como cuidamos dos seus dados</h1>
      <p className="medida mt-6 text-[1.125rem] text-texto-2">
        O MoCCa é um projeto de estudantes da Universidade Federal de Lavras. Este texto explica o que acontece com os
        dados enviados pelo <Link href="/contato" className="link">formulário de contato</Link>.
      </p>

      <div className="mt-12 max-w-3xl divide-y divide-linha border-y border-linha">
        {secoes.map((s) => (
          <section key={s.titulo} className="grid gap-3 py-8 md:grid-cols-[220px_1fr] md:gap-8">
            <h2 className="t-h3 text-texto">{s.titulo}</h2>
            <div className="medida text-texto-2">{s.corpo}</div>
          </section>
        ))}
      </div>
      <p className="t-pequeno mt-8 text-texto-2">Atualizado em 29/10/2026.</p>
    </div>
  );
}
