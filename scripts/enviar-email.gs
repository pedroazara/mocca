// App da Web que envia os e-mails automáticos do site pela conta
// moccaufla@gmail.com. Ele roda em script.google.com, dentro dessa conta; esta
// cópia fica aqui só para referência. O site (lib/email) faz um POST com a
// chave guardada nas propriedades do script.
//
// Implantação: Implantar › Nova implantação › App da Web, executar como "Eu",
// acesso "Qualquer pessoa". A chave sai de criarChave(), rodada no editor.

function doPost(e) {
  const chave = PropertiesService.getScriptProperties().getProperty("CHAVE");
  let d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (erro) {
    return resposta({ ok: false, erro: "JSON inválido" });
  }
  if (!chave || d.chave !== chave) return resposta({ ok: false, erro: "Chave inválida" });
  try {
    MailApp.sendEmail({ to: d.para, subject: d.assunto, body: d.texto, htmlBody: d.html, name: "MoCCa" });
    return resposta({ ok: true, restantes: MailApp.getRemainingDailyQuota() });
  } catch (erro) {
    return resposta({ ok: false, erro: String(erro) });
  }
}

function resposta(dados) {
  return ContentService.createTextOutput(JSON.stringify(dados)).setMimeType(ContentService.MimeType.JSON);
}

// Rode no editor (Executar › criarChave): grava uma chave nova e mostra no
// registro de execução, para ir em GMAIL_SCRIPT_CHAVE. Rodar de novo troca a chave.
function criarChave() {
  const chave = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty("CHAVE", chave);
  Logger.log(chave);
}
