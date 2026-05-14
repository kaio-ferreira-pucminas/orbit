// templates.js — HTML dos emails da Orbit
// Estrutura email-safe (table-based + inline styles) compatível com qualquer cliente

const TOKENS = {
  primary:   '#4648D4',
  primaryDk: '#3537B8',
  text:      '#131B2E',
  body:      '#46455A',
  muted:     '#76758A',
  bgLight:   '#FAF8FF',
  border:    '#E2E7FF',
  white:     '#FFFFFF',
  danger:    '#C0392B',
};

/* ─── Layout base reusado por todos os emails ─── */
function baseLayout({ title, preheader = '', body }) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${TOKENS.bgLight};font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TOKENS.text};">

  <!-- preheader (texto que aparece como prévia na inbox, invisível no corpo) -->
  <div style="display:none;font-size:1px;color:${TOKENS.bgLight};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${TOKENS.bgLight};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${TOKENS.white};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(19,27,46,0.06);">

          <!-- Header: logo + faixa de cor primária -->
          <tr>
            <td style="background:linear-gradient(135deg,${TOKENS.primary} 0%,#6063EE 100%);padding:32px 40px;text-align:center;">
              <span style="display:inline-block;color:${TOKENS.white};font-family:'Manrope',-apple-system,Helvetica,Arial,sans-serif;font-weight:800;font-size:28px;letter-spacing:-1px;line-height:1;">Orbit</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;border-top:1px solid ${TOKENS.border};text-align:center;">
              <p style="margin:0 0 8px;color:${TOKENS.muted};font-size:12px;line-height:18px;">
                Este email foi enviado pela <strong style="color:${TOKENS.text};">Orbit</strong> — plataforma que conecta desenvolvedores e empresas.
              </p>
              <p style="margin:0;color:${TOKENS.muted};font-size:11px;line-height:16px;">
                Você está recebendo porque tem uma conta cadastrada. Caso não reconheça esta atividade, ignore esta mensagem.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

/* ─── Botão CTA reusable ─── */
function button(label, url, color = TOKENS.primary) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td style="background:${color};border-radius:8px;">
          <a href="${url}" target="_blank"
            style="display:inline-block;padding:14px 28px;color:${TOKENS.white};font-family:'Inter',Helvetica,Arial,sans-serif;font-weight:700;font-size:15px;line-height:1.2;text-decoration:none;border-radius:8px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/* =========================================================
   1. Welcome email — disparado após o cadastro
========================================================= */
function welcomeEmail({ name, appUrl }) {
  const body = `
    <h1 style="margin:0 0 16px;color:${TOKENS.text};font-family:'Manrope',Helvetica,Arial,sans-serif;font-weight:800;font-size:26px;line-height:32px;letter-spacing:-0.5px;">
      Bem-vindo(a) à Orbit, ${escapeHtml(name)}! 🚀
    </h1>
    <p style="margin:0 0 16px;color:${TOKENS.body};font-size:15px;line-height:24px;">
      Sua conta foi criada com sucesso. Aqui é onde dev junior valida habilidades em projetos reais e empresa encontra talento pronto pra produção — tudo no mesmo lugar.
    </p>
    <p style="margin:0 0 8px;color:${TOKENS.body};font-size:15px;line-height:24px;">
      Pra começar:
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;color:${TOKENS.body};font-size:15px;line-height:26px;">
      <li>Complete seu perfil com bio, habilidades e portfólio</li>
      <li>Explore o feed da comunidade e siga outros devs</li>
      <li>Compartilhe seu primeiro post</li>
    </ul>
    ${button('Acessar minha conta', `${appUrl}/pages/feed.html`)}
    <p style="margin:24px 0 0;color:${TOKENS.muted};font-size:13px;line-height:20px;">
      Qualquer dúvida, é só responder este email — a gente lê todas as mensagens.
    </p>
  `;

  return {
    subject: `Bem-vindo(a) à Orbit, ${name}!`,
    html: baseLayout({
      title: 'Bem-vindo à Orbit',
      preheader: 'Sua conta foi criada com sucesso. Acesse a plataforma e explore.',
      body,
    }),
  };
}

/* =========================================================
   2. Reset password email — link único com token
========================================================= */
function resetPasswordEmail({ name, resetUrl, expiresInMinutes }) {
  const body = `
    <h1 style="margin:0 0 16px;color:${TOKENS.text};font-family:'Manrope',Helvetica,Arial,sans-serif;font-weight:800;font-size:24px;line-height:32px;letter-spacing:-0.5px;">
      Redefinir sua senha
    </h1>
    <p style="margin:0 0 16px;color:${TOKENS.body};font-size:15px;line-height:24px;">
      Olá ${escapeHtml(name)}, recebemos um pedido pra redefinir a senha da sua conta na Orbit.
    </p>
    <p style="margin:0 0 8px;color:${TOKENS.body};font-size:15px;line-height:24px;">
      Clique no botão abaixo pra criar uma nova senha:
    </p>
    ${button('Redefinir minha senha', resetUrl)}
    <p style="margin:24px 0 8px;color:${TOKENS.muted};font-size:13px;line-height:20px;">
      Este link expira em <strong style="color:${TOKENS.text};">${expiresInMinutes} minutos</strong> e pode ser usado apenas uma vez.
    </p>
    <p style="margin:0 0 0;color:${TOKENS.muted};font-size:13px;line-height:20px;">
      Caso não tenha sido você, pode ignorar este email — sua senha continua a mesma.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;background:${TOKENS.bgLight};border-radius:8px;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 4px;color:${TOKENS.muted};font-size:11px;line-height:16px;text-transform:uppercase;letter-spacing:0.5px;">
            Caso o botão não funcione, copie o link:
          </p>
          <p style="margin:0;color:${TOKENS.primary};font-size:11px;line-height:16px;word-break:break-all;font-family:'Courier New',monospace;">
            ${resetUrl}
          </p>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: 'Redefinir sua senha — Orbit',
    html: baseLayout({
      title: 'Redefinir sua senha',
      preheader: `Use o link para criar uma nova senha. Expira em ${expiresInMinutes} minutos.`,
      body,
    }),
  };
}

/* =========================================================
   3. Deactivation code email — código 6 dígitos
========================================================= */
function deactivationCodeEmail({ name, code, expiresInMinutes }) {
  const body = `
    <h1 style="margin:0 0 16px;color:${TOKENS.text};font-family:'Manrope',Helvetica,Arial,sans-serif;font-weight:800;font-size:24px;line-height:32px;letter-spacing:-0.5px;">
      Confirme a desativação da sua conta
    </h1>
    <p style="margin:0 0 16px;color:${TOKENS.body};font-size:15px;line-height:24px;">
      Olá ${escapeHtml(name)}, recebemos um pedido pra desativar sua conta na Orbit.
    </p>
    <p style="margin:0 0 8px;color:${TOKENS.body};font-size:15px;line-height:24px;">
      Pra confirmar, copie o código abaixo e cole na tela de desativação:
    </p>

    <!-- Código grande -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr>
        <td align="center" style="background:${TOKENS.bgLight};border:2px dashed ${TOKENS.border};border-radius:12px;padding:24px;">
          <p style="margin:0 0 6px;color:${TOKENS.muted};font-size:11px;line-height:16px;text-transform:uppercase;letter-spacing:1px;">
            Código de confirmação
          </p>
          <p style="margin:0;color:${TOKENS.primary};font-family:'Courier New',monospace;font-size:36px;font-weight:700;line-height:42px;letter-spacing:8px;">
            ${code}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;color:${TOKENS.muted};font-size:13px;line-height:20px;">
      Este código expira em <strong style="color:${TOKENS.text};">${expiresInMinutes} minutos</strong>.
    </p>

    <!-- Aviso 30 dias -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;background:#FEF7F2;border-left:3px solid #F59E0B;border-radius:4px;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 4px;color:${TOKENS.text};font-size:13px;font-weight:700;line-height:20px;">
            ⏳ Você tem 30 dias pra mudar de ideia
          </p>
          <p style="margin:0;color:${TOKENS.body};font-size:13px;line-height:20px;">
            Sua conta ficará desativada por 30 dias. Se voltar a fazer login antes desse prazo, ela é reativada automaticamente. Após 30 dias, todos os dados são <strong>permanentemente excluídos</strong>.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;color:${TOKENS.muted};font-size:13px;line-height:20px;">
      Caso não tenha sido você, ignore este email e altere sua senha por precaução.
    </p>
  `;

  return {
    subject: `Código de desativação: ${code}`,
    html: baseLayout({
      title: 'Confirme a desativação',
      preheader: `Seu código é ${code}. Expira em ${expiresInMinutes} minutos.`,
      body,
    }),
  };
}

/* =========================================================
   4. Account deleted email — disparado após 30 dias
========================================================= */
function accountDeletedEmail({ name }) {
  const body = `
    <h1 style="margin:0 0 16px;color:${TOKENS.text};font-family:'Manrope',Helvetica,Arial,sans-serif;font-weight:800;font-size:24px;line-height:32px;letter-spacing:-0.5px;">
      Sua conta foi excluída
    </h1>
    <p style="margin:0 0 16px;color:${TOKENS.body};font-size:15px;line-height:24px;">
      Olá ${escapeHtml(name)}, completamos a exclusão da sua conta na Orbit conforme solicitado há 30 dias.
    </p>
    <p style="margin:0 0 16px;color:${TOKENS.body};font-size:15px;line-height:24px;">
      Todos os seus dados pessoais (perfil, posts, comentários, currículo) foram permanentemente removidos do nosso banco de dados.
    </p>
    <p style="margin:0;color:${TOKENS.body};font-size:15px;line-height:24px;">
      Obrigado por ter feito parte da nossa comunidade. Se um dia quiser voltar, é só criar uma nova conta.
    </p>
  `;

  return {
    subject: 'Sua conta na Orbit foi excluída',
    html: baseLayout({
      title: 'Conta excluída',
      preheader: 'Confirmamos a exclusão da sua conta após o período de 30 dias.',
      body,
    }),
  };
}

/* ─── Helper para escape ─── */
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, ch => map[ch]);
}

module.exports = {
  welcomeEmail,
  resetPasswordEmail,
  deactivationCodeEmail,
  accountDeletedEmail,
};
