// emailService.js — Envio de emails via Resend + audit log no db.json
//
// Comportamento:
// 1. Salva sempre uma cópia em sent_emails[] (audit + visualização local)
// 2. Se RESEND_API_KEY estiver configurada, envia via Resend de verdade
// 3. Se Resend falhar ou não estiver configurada, registra warning mas NÃO quebra
//    o fluxo (o usuário ainda consegue continuar usando a aplicação)

const { Resend } = require('resend');
const crypto = require('crypto');

const API_KEY    = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const FROM_NAME  = process.env.RESEND_FROM_NAME || 'Orbit';

const resend = API_KEY ? new Resend(API_KEY) : null;

/**
 * Envia um email + registra no db.json.
 * @param {object} db        - Banco em memória (será mutado: db.sent_emails)
 * @param {object} options   - { to, subject, html, type, userId }
 * @returns {Promise<object>} - { id, savedAt, providerId, providerError }
 */
async function sendEmail(db, { to, subject, html, type, userId }) {
  if (!Array.isArray(db.sent_emails)) db.sent_emails = [];

  const record = {
    id:           crypto.randomUUID(),
    type,                                      // welcome | reset | deactivation | deleted
    to,
    subject,
    html,
    userId:       userId || null,
    createdAt:    new Date().toISOString(),
    providerId:   null,                        // ID retornado pela Resend
    providerError: null,
  };

  // Tenta enviar via Resend (se configurada)
  if (resend && FROM_EMAIL) {
    try {
      const { data, error } = await resend.emails.send({
        from:    `${FROM_NAME} <${FROM_EMAIL}>`,
        to:      [to],
        subject,
        html,
      });

      if (error) {
        record.providerError = error.message || JSON.stringify(error);
        console.warn(`⚠️  Resend retornou erro ao enviar para ${to}: ${record.providerError}`);
      } else {
        record.providerId = data?.id || null;
        console.log(`📧 Email enviado via Resend para ${to} (id: ${record.providerId})`);
      }
    } catch (err) {
      record.providerError = err.message || String(err);
      console.warn(`⚠️  Falha ao chamar Resend para ${to}: ${record.providerError}`);
    }
  } else {
    console.log(`📭 [SIMULADO] Email para ${to} — "${subject}" (configure RESEND_API_KEY no .env para envio real)`);
  }

  db.sent_emails.push(record);
  return record;
}

module.exports = { sendEmail };
