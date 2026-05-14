// auth.js — Orbit
// JS puro, sem framework

(function () {
  'use strict';

  const API_URL = 'http://localhost:3001';

  /* -----------------------------------------------
     TABS: Entrar / Criar Conta
  ----------------------------------------------- */
  const tabs         = document.querySelectorAll('.auth-tab');
  const formLogin    = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  function switchTab(target) {
    tabs.forEach((t) => {
      const isActive = t.dataset.tab === target;
      t.classList.toggle('auth-tab--active', isActive);
      t.setAttribute('aria-selected', String(isActive));
    });

    if (target === 'login') {
      formLogin.classList.remove('auth-form--hidden');
      formRegister.classList.add('auth-form--hidden');
    } else {
      formLogin.classList.add('auth-form--hidden');
      formRegister.classList.remove('auth-form--hidden');
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Links cruzados: "Criar conta grátis" / "Já tem conta?"
  document.querySelectorAll('[data-switch]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(link.dataset.switch);
    });
  });

  /* -----------------------------------------------
     TOGGLE DE TIPO DE CONTA: Desenvolvedor / Empresa
  ----------------------------------------------- */
  const toggleBtns  = document.querySelectorAll('.account-toggle__btn');
  const formDev     = document.getElementById('form-dev');
  const formCompany = document.getElementById('form-company');

  function switchAccountType(type) {
    toggleBtns.forEach((btn) => {
      const isActive = btn.dataset.type === type;
      btn.classList.toggle('account-toggle__btn--active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    if (type === 'dev') {
      formDev.classList.remove('register-form--hidden');
      formCompany.classList.add('register-form--hidden');
    } else {
      formDev.classList.add('register-form--hidden');
      formCompany.classList.remove('register-form--hidden');
    }
  }

  toggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchAccountType(btn.dataset.type));
  });

  /* -----------------------------------------------
     MOSTRAR / OCULTAR SENHA
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
     MÁSCARA DE CNPJ
  ----------------------------------------------- */
  const cnpjInput = document.getElementById('co-cnpj');
  if (cnpjInput) {
    cnpjInput.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '').slice(0, 14);

      if (v.length > 12) {
        v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
      } else if (v.length > 8) {
        v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
      } else if (v.length > 5) {
        v = v.replace(/^(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
      } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d+)/, '$1.$2');
      }

      this.value = v;
    });
  }

  /* -----------------------------------------------
     FEEDBACK DE ERRO INLINE
  ----------------------------------------------- */
  function showError(formEl, message) {
    let el = formEl.querySelector('.auth-api-error');
    if (!el) {
      el = document.createElement('p');
      el.className = 'auth-api-error';
      // Insere antes do botão submit dentro do seu pai direto
      const btn = formEl.querySelector('[type="submit"]');
      btn.parentElement.insertBefore(el, btn);
    }
    el.textContent = message;
    el.style.display = 'block';
  }

  function clearError(formEl) {
    const el = formEl.querySelector('.auth-api-error');
    if (el) el.style.display = 'none';
  }

  function setLoading(btn, loading) {
    btn.disabled   = loading;
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
    btn.textContent = loading ? 'Aguarde...' : btn.dataset.originalText;
  }

  /* -----------------------------------------------
     LOGIN
  ----------------------------------------------- */
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError(formLogin);

      const email    = formLogin.querySelector('#login-email').value.trim();
      const password = formLogin.querySelector('#login-password').value;
      const btn      = formLogin.querySelector('[type="submit"]');

      setLoading(btn, true);

      try {
        const res  = await fetch(`${API_URL}/api/auth/login`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          showError(formLogin, data.error || 'Erro ao fazer login.');
          return;
        }

        // Salva token e dados do usuário
        localStorage.setItem('orbit_token', data.token);
        localStorage.setItem('orbit_user',  JSON.stringify(data.user));

        // Redireciona para home (dashboard futuro)
        window.location.href = '../pages/index.html';

      } catch {
        showError(formLogin, 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
      } finally {
        setLoading(btn, false);
      }
    });
  }

  /* -----------------------------------------------
     CADASTRO — DESENVOLVEDOR
  ----------------------------------------------- */
  if (formDev) {
    formDev.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError(formDev);

      const name     = formDev.querySelector('#dev-name').value.trim();
      const email    = formDev.querySelector('#dev-email').value.trim();
      const password = formDev.querySelector('#dev-password').value;
      const confirm  = formDev.querySelector('#dev-confirm').value;
      const github   = formDev.querySelector('#dev-github').value.trim() || null;
      const btn      = formDev.querySelector('[type="submit"]');

      if (password !== confirm) {
        showError(formDev, 'As senhas não coincidem.');
        return;
      }

      setLoading(btn, true);

      try {
        const res  = await fetch(`${API_URL}/api/auth/register`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ type: 'dev', name, email, password, github, cpfCnpj: null }),
        });

        const data = await res.json();

        if (!res.ok) {
          showError(formDev, data.error || 'Erro ao criar conta.');
          return;
        }

        localStorage.setItem('orbit_token', data.token);
        localStorage.setItem('orbit_user',  JSON.stringify(data.user));

        window.location.href = '../pages/index.html';

      } catch {
        showError(formDev, 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
      } finally {
        setLoading(btn, false);
      }
    });
  }

  /* -----------------------------------------------
     CADASTRO — EMPRESA
  ----------------------------------------------- */
  if (formCompany) {
    formCompany.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError(formCompany);

      const name     = formCompany.querySelector('#co-name').value.trim();
      const cpfCnpj  = formCompany.querySelector('#co-cnpj').value.trim();
      const email    = formCompany.querySelector('#co-email').value.trim();
      const password = formCompany.querySelector('#co-password').value;
      const confirm  = formCompany.querySelector('#co-confirm').value;
      const btn      = formCompany.querySelector('[type="submit"]');

      if (password !== confirm) {
        showError(formCompany, 'As senhas não coincidem.');
        return;
      }

      setLoading(btn, true);

      try {
        const res  = await fetch(`${API_URL}/api/auth/register`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ type: 'company', name, email, password, github: null, cpfCnpj }),
        });

        const data = await res.json();

        if (!res.ok) {
          showError(formCompany, data.error || 'Erro ao criar conta.');
          return;
        }

        localStorage.setItem('orbit_token', data.token);
        localStorage.setItem('orbit_user',  JSON.stringify(data.user));

        window.location.href = '../pages/index.html';

      } catch {
        showError(formCompany, 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
      } finally {
        setLoading(btn, false);
      }
    });
  }

  /* -----------------------------------------------
     MODAL DE TERMOS E CONDIÇÕES
  ----------------------------------------------- */
  const modalOverlay = document.getElementById('terms-modal');
  const modalClose   = document.getElementById('modal-close');
  const modalAccept  = document.getElementById('modal-accept');
  const modalReject  = document.getElementById('modal-reject');

  let activeForm = null;

  function openModal(form) {
    activeForm = form;
    modalOverlay.classList.add('modal-overlay--open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => modalClose && modalClose.focus(), 50);
  }

  function closeModal() {
    modalOverlay.classList.remove('modal-overlay--open');
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    activeForm = null;
  }

  document.querySelectorAll('.terms-link').forEach((link) => {
    link.addEventListener('click', () => openModal(link.dataset.targetForm));
  });

  if (modalClose) modalClose.addEventListener('click', closeModal);

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('modal-overlay--open')) {
      closeModal();
    }
  });

  if (modalAccept) {
    modalAccept.addEventListener('click', () => {
      if (activeForm) {
        const checkbox = document.getElementById('terms-' + activeForm);
        const submit   = document.getElementById('submit-' + activeForm);
        if (checkbox) checkbox.checked = true;
        if (submit)   submit.disabled  = false;
      }
      closeModal();
    });
  }

  if (modalReject) {
    modalReject.addEventListener('click', () => {
      if (activeForm) {
        const checkbox = document.getElementById('terms-' + activeForm);
        const submit   = document.getElementById('submit-' + activeForm);
        if (checkbox) checkbox.checked = false;
        if (submit)   submit.disabled  = true;
      }
      closeModal();
    });
  }

  /* -----------------------------------------------
     CHECKBOX → habilitar / desabilitar submit
  ----------------------------------------------- */
  document.querySelectorAll('.terms-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const submit = document.getElementById('submit-' + checkbox.dataset.form);
      if (submit) submit.disabled = !checkbox.checked;
    });
  });

  /* -----------------------------------------------
     INICIALIZAÇÃO POR URL PARAMS
  ----------------------------------------------- */
  (function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const tab    = params.get('tab');
    const type   = params.get('type');

    if (tab === 'register' || tab === 'login') switchTab(tab);

    if (type === 'dev' || type === 'company') {
      switchTab('register');
      switchAccountType(type);
    }
  })();

})();
