// reset-password.js — Orbit
// Define nova senha a partir do token recebido por email

(function () {
  'use strict';

  const API_URL = 'http://localhost:3001';

  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');

  const formPanel    = document.getElementById('form-reset');
  const errorPanel   = document.getElementById('form-error');

  // Token ausente → mostra erro
  if (!token) {
    formPanel.classList.add('auth-form--hidden');
    errorPanel.classList.remove('auth-form--hidden');
    return;
  }

  /* -----------------------------------------------
     Mostrar / Ocultar senha (igual ao auth.js)
  ----------------------------------------------- */
  document.querySelectorAll('.field__eye').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
      btn.style.opacity = isPassword ? '1' : '0.5';
    });
  });

  /* -----------------------------------------------
     Submit
  ----------------------------------------------- */
  const form        = document.getElementById('form-reset-body');
  const passInput   = document.getElementById('reset-password');
  const confInput   = document.getElementById('reset-confirm');
  const submitBtn   = document.getElementById('reset-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = passInput.value;
    const confirm  = confInput.value;

    if (password.length < 8) {
      window.showToast('A senha precisa ter pelo menos 8 caracteres.', 'error');
      return;
    }
    if (password !== confirm) {
      window.showToast('As senhas não coincidem.', 'error');
      return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Redefinindo...';

    try {
      const res  = await fetch(`${API_URL}/api/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Token inválido/expirado → mostra a tela de erro
        if (res.status === 400 && data.error?.includes('Link inválido')) {
          formPanel.classList.add('auth-form--hidden');
          errorPanel.classList.remove('auth-form--hidden');
          return;
        }
        window.showToast(data.error || 'Erro ao redefinir senha.', 'error');
        return;
      }

      window.showToast('Senha redefinida com sucesso!', 'success');
      setTimeout(() => {
        window.location.href = 'auth.html?tab=login';
      }, 1500);

    } catch {
      window.showToast('Não foi possível conectar ao servidor.', 'error');
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Redefinir senha';
    }
  });

})();
