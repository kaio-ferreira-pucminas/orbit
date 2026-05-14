// forgot-password.js — Orbit
// Solicita link de redefinição de senha por email

(function () {
  'use strict';

  const API_URL = 'http://localhost:3001';

  const form         = document.getElementById('form-forgot-body');
  const emailInput   = document.getElementById('forgot-email');
  const submitBtn    = document.getElementById('forgot-submit');
  const successPanel = document.getElementById('forgot-success');
  const formPanel    = document.getElementById('form-forgot');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!email) {
      window.showToast('Informe seu e-mail.', 'error');
      return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Enviando...';

    try {
      const res  = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Erro ao solicitar redefinição.', 'error');
        return;
      }

      // Por segurança o backend sempre retorna sucesso (não revela se o email existe)
      // Mostramos a tela de confirmação independente do resultado
      formPanel.querySelector('.auth-form__header').style.display = 'none';
      formPanel.querySelector('.auth-form__body').style.display   = 'none';
      successPanel.classList.remove('auth-form__success--hidden');

      window.showToast('Link de recuperação enviado!', 'success');
    } catch {
      window.showToast('Não foi possível conectar ao servidor.', 'error');
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Enviar link de recuperação';
    }
  });

})();
