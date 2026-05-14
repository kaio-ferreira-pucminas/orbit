// auth.js — Orbit
// JS puro, sem framework

(function () {
  'use strict';

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

      // Troca visual do ícone via opacidade
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
     SUBMIT — placeholder para integração futura
  ----------------------------------------------- */
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // TODO: integrar com backend / API
    });
  });

  /* -----------------------------------------------
     MODAL DE TERMOS E CONDIÇÕES
  ----------------------------------------------- */
  const modalOverlay = document.getElementById('terms-modal');
  const modalClose   = document.getElementById('modal-close');
  const modalAccept  = document.getElementById('modal-accept');
  const modalReject  = document.getElementById('modal-reject');

  let activeForm = null; // 'dev' | 'company'

  function openModal(form) {
    activeForm = form;
    modalOverlay.classList.add('modal-overlay--open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    // foca o botão fechar para acessibilidade
    setTimeout(() => modalClose && modalClose.focus(), 50);
  }

  function closeModal() {
    modalOverlay.classList.remove('modal-overlay--open');
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    activeForm = null;
  }

  // Abrir modal ao clicar no link de termos
  document.querySelectorAll('.terms-link').forEach((link) => {
    link.addEventListener('click', () => openModal(link.dataset.targetForm));
  });

  // Fechar via botão X
  if (modalClose) modalClose.addEventListener('click', closeModal);

  // Fechar via clique no backdrop (fora do modal)
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // Fechar via tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('modal-overlay--open')) {
      closeModal();
    }
  });

  // ACEITAR — marca checkbox e habilita submit
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

  // RECUSAR — desmarca checkbox e desabilita submit
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
     Lê ?tab=login|register e ?type=dev|company
     Ex: auth.html?tab=register&type=company
  ----------------------------------------------- */
  (function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const tab    = params.get('tab');
    const type   = params.get('type');

    if (tab === 'register' || tab === 'login') {
      switchTab(tab);
    }

    if (type === 'dev' || type === 'company') {
      // garante que o form de cadastro esteja visível antes de trocar o tipo
      switchTab('register');
      switchAccountType(type);
    }
  })();

})();
