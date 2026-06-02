// completar-perfil-empresa.js — Orbit · Completar Perfil da Empresa (wizard) + Interesses
// JS puro. Backend: PUT /api/companies/me (cria/atualiza a empresa do usuário logado).

(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';

  /* ===== AUTH GUARD ===== */
  const token    = localStorage.getItem('orbit_token');
  const userJson = localStorage.getItem('orbit_user');
  if (!token || !userJson) { window.location.href = '/pages/auth.html?tab=login'; return; }
  const currentUser = JSON.parse(userJson);

  /* ===== HELPERS ===== */
  function $(s) { return document.querySelector(s); }
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
  }
  function initials(name) {
    if (!name) return 'E';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }
  function toast(msg, type) { if (window.orbitToast) window.orbitToast(msg, type || 'info'); }
  async function api(path, options) {
    const res = await fetch(`${API_URL}${path}`, Object.assign({}, options, {
      headers: Object.assign({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, (options && options.headers) || {}),
    }));
    if (res.status === 401) {
      localStorage.removeItem('orbit_token'); localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
      throw new Error('Token expirado');
    }
    return res;
  }

  /* ===== ESTADO ===== */
  let interests = [];
  const CURATED_INTERESTS = [
    'Frontend', 'Backend', 'Mobile', 'IA & Dados', 'UX/UI', 'Web3 & Blockchain',
    'Cloud', 'DevOps', 'Cybersecurity', 'Game Dev', 'Produto', 'Design',
  ];

  /* ===== WIZARD ===== */
  let step = 1;
  const TOTAL = 2;
  function showStep(n) {
    step = Math.max(1, Math.min(TOTAL, n));
    document.querySelectorAll('.cp-step').forEach(el =>
      el.classList.toggle('cp-step--active', Number(el.getAttribute('data-step')) === step));
    document.querySelectorAll('[data-step-label]').forEach(el =>
      el.classList.toggle('cp-steps__label--active', Number(el.getAttribute('data-step-label')) <= step));
    $('#cp-step-count').textContent = `Passo ${step} de ${TOTAL}`;
    const pct = Math.round(step / TOTAL * 100);
    $('#cp-step-pct').textContent = pct + '%';
    $('#cp-steps-fill').style.width = pct + '%';
    $('#btn-back').hidden   = step === 1;
    $('#btn-next').hidden   = step === TOTAL;
    $('#btn-finish').hidden = step !== TOTAL;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ===== INTERESSES ===== */
  function renderInterests() {
    const grid = $('#cp-interests');
    const display = [...CURATED_INTERESTS];
    interests.forEach(i => { if (!display.some(d => d.toLowerCase() === i.toLowerCase())) display.push(i); });
    grid.innerHTML = display.map(it => {
      const active = interests.some(i => i.toLowerCase() === it.toLowerCase());
      return `<button type="button" class="cp-interest-chip${active ? ' cp-interest-chip--active' : ''}" data-interest="${escapeHtml(it)}">${escapeHtml(it)}</button>`;
    }).join('');
  }
  function toggleInterest(name) {
    const idx = interests.findIndex(i => i.toLowerCase() === name.toLowerCase());
    if (idx >= 0) interests.splice(idx, 1); else interests.push(name);
    renderInterests();
  }
  function addInterest(value) {
    const v = value.trim();
    if (!v) return;
    if (!interests.some(i => i.toLowerCase() === v.toLowerCase())) interests.push(v);
    renderInterests();
  }

  /* ===== SALVAR ===== */
  async function save() {
    const name = $('#co-name').value.trim();
    if (!name) { showStep(1); toast('Informe o nome da empresa.', 'error'); $('#co-name').focus(); return; }

    const btn = $('#btn-finish');
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.textContent = 'Salvando...';

    const foundedRaw = $('#co-founded').value.trim();
    const payload = {
      name,
      industry: $('#co-industry').value.trim(),
      location: $('#co-location').value.trim(),
      size:     $('#co-size').value,
      founded:  foundedRaw ? parseInt(foundedRaw, 10) : null,
      website:  $('#co-website').value.trim(),
      tagline:  $('#co-tagline').value.trim(),
      about:    $('#co-about').value.trim(),
      interests,
    };

    try {
      const res = await api('/api/companies/me', { method: 'PUT', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { btn.disabled = false; btn.innerHTML = original; toast(data.error || 'Erro ao salvar.', 'error'); return; }
      toast('Perfil da empresa salvo com sucesso!', 'success');
      // Vai para o perfil do usuário logado (que se adapta para empresa), não para o perfil público
      setTimeout(() => { window.location.href = '/pages/profile.html'; }, 800);
    } catch (err) {
      if (err.message !== 'Token expirado') { btn.disabled = false; btn.innerHTML = original; toast('Não foi possível salvar.', 'error'); }
    }
  }

  /* ===== PREFILL ===== */
  function fill(company) {
    $('#co-name').value     = (company && company.name) || currentUser.name || '';
    $('#co-industry').value = (company && company.industry) || '';
    $('#co-location').value = (company && company.location) || '';
    $('#co-size').value     = (company && company.size) || '';
    $('#co-founded').value  = (company && company.founded) || '';
    $('#co-website').value  = (company && company.website) || '';
    $('#co-tagline').value  = (company && company.tagline) || '';
    $('#co-about').value    = (company && company.about) || '';
    interests = (company && Array.isArray(company.interests)) ? [...company.interests] : [];
    renderInterests();
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#cp-interests').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-interest]');
      if (btn) toggleInterest(btn.getAttribute('data-interest'));
    });
    $('#interest-input').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); addInterest(ev.target.value); ev.target.value = ''; }
    });
    $('#btn-next').addEventListener('click', () => showStep(step + 1));
    $('#btn-back').addEventListener('click', () => showStep(step - 1));
    $('#btn-finish').addEventListener('click', save);
  }

  /* ===== INIT ===== */
  async function init() {
    $('#cp-initials').textContent = initials(currentUser.name);
    setupEvents();
    let company = null;
    try {
      const res = await api('/api/companies/me');
      if (res.ok) { const data = await res.json(); company = data.company; }
    } catch (err) { if (err.message === 'Token expirado') return; }
    fill(company);
    showStep(1);
  }

  init();

})();
